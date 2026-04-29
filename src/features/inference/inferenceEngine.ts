/**
 * INFERENCE ENGINE
 *
 * Two recognition modes, selected at load time:
 *
 *   'embeddings' (primary)
 *     COCO-SSD → multi-candidate ranking → prescore (embedding+OCR) → crop
 *     → MobileNet embedding → cosine similarity search → stability tracking → result.
 *
 *   'classifier' (fallback)
 *     Same pipeline up to crop, then Dense head → softmax.
 *
 * Candidate selection:
 *   All COCO detections above a minimum threshold are first ranked by spatial
 *   signals (center + area + detector). When in embeddings mode, the top
 *   MAX_PRESCORE_CANDIDATES are prescored (embedding + OCR hint) and re-ranked
 *   using the full 5-signal formula before temporal tracking selects the winner.
 *
 *   Prescore is skipped when the lock is stable AND the interval has not elapsed,
 *   and the previously cached embedding for the locked candidate is reused in
 *   the recognition phase to avoid redundant inference.
 *
 * Temporal tracking (LOCK_MIN_FRAMES hold + IoU continuity + weak-signal release):
 *   Keeps the selected bbox stable across frames. Releases the lock when:
 *     - The locked bbox no longer overlaps any current detection (IoU < CONTINUITY_IOU)
 *     - A significantly better candidate appears after LOCK_MIN_FRAMES hold
 *     - The embedding signal stays weak for WEAK_SIG_THRESHOLD frames
 */

import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'
import { deserializeModel } from '@/features/training/modelSerializer'
import { PredictionSmoother, REQUIRED_STREAK } from './predictionSmoothing'
import { detectAllObjects, squareCropCanvas, preloadDetector } from '@/features/segmentation/objectCropper'
import { rankCandidates, rerankAfterPrescore, bboxIoU } from '@/features/segmentation/candidateRanker'
import type { ScoredCandidate } from '@/features/segmentation/candidateRanker'
import { getAllEmbeddings } from '@/features/embeddings/embeddingStore'
import { generateEmbedding } from '@/features/embeddings/embeddingEngine'
import { findBestMatches } from '@/features/embeddings/similaritySearch'
import type { StoredEmbeddingRecord } from '@/features/embeddings/embeddingStore'
import { extractText } from '@/features/ocr/ocrEngine'

export type InferenceMode = 'embeddings' | 'classifier'

export interface DetectionInfo {
  bbox: [number, number, number, number]
  score: number
  label: string
}

/** Serializable candidate snapshot for FrameResult / DebugPrediction. */
export interface CandidateInfo {
  normBbox: [number, number, number, number]
  label: string
  centerScore: number
  areaScore: number
  detectorScore: number
  embeddingScore: number
  ocrScore: number
  prescored: boolean
  finalScore: number
  isLocked: boolean
}

export interface FrameResult {
  stable: { classId: string; avgConfidence: number; streak: number } | null
  bestGuess: { classId: string; confidence: number; streak: number; allProbs: number[] } | null
  detection: DetectionInfo | null
  cropThumbnail: string | null
  cropMethod: string
  requiredStreak: number
  mode: InferenceMode
  ocrText: string | null
  /** All ranked COCO candidates this frame (best first). Empty when COCO sees nothing. */
  candidates: CandidateInfo[]
  /** How many consecutive frames the current candidate has been locked. */
  lockedFrames: number
}

// ── Tracking constants ────────────────────────────────────────────────────────

/** Minimum frames to hold the current bbox before considering a switch. */
const LOCK_MIN_FRAMES = 8

/**
 * A new candidate must exceed the locked candidate's score by this margin
 * to trigger a switch (after LOCK_MIN_FRAMES have elapsed).
 */
const SWITCH_THRESHOLD = 0.20

/**
 * If the locked candidate's max embedding similarity stays below this value
 * for WEAK_SIG_THRESHOLD consecutive frames, release the lock.
 */
const WEAK_SIG_MIN = 0.25
const WEAK_SIG_THRESHOLD = 3

/** Minimum IoU with the previously locked bbox to count as "still visible". */
const CONTINUITY_IOU = 0.30

// ── Prescore constants ────────────────────────────────────────────────────────

/** Number of top spatial candidates to prescore with embedding + OCR. */
const MAX_PRESCORE_CANDIDATES = 3

/**
 * Prescore runs every N frames even when the lock is stable,
 * to catch improvements and keep the cache warm.
 */
const PRESCORE_INTERVAL = 20

// ── Engine class ──────────────────────────────────────────────────────────────

export class InferenceEngine {
  private model: tf.LayersModel | null = null
  private extractor: Awaited<ReturnType<typeof loadFeatureExtractor>> | null = null
  private classIds: string[] = []
  private storedEmbeddings: StoredEmbeddingRecord[] = []
  private mode: InferenceMode = 'classifier'
  private smoother = new PredictionSmoother()
  private rafId: number | null = null
  private frameCount = 0
  private lastFpsTime = 0

  // ── Temporal tracking ─────────────────────────────────────────────────────
  private lockedCandidate: ScoredCandidate | null = null
  private lockedFrames = 0
  private weakSigFrames = 0

  // ── Prescore state ────────────────────────────────────────────────────────
  /** Cached embeddings keyed by bboxKey. Reused in recognition phase. */
  private prescoredEmbeddings = new Map<string, Float32Array>()
  /** OCR hint from previous frame (propagated from useInference hook). */
  private ocrHintClassId: string | null = null
  private ocrHintScore = 0

  // ── OCR (decoupled, rate-limited) ─────────────────────────────────────────
  private videoEl: HTMLVideoElement | null = null
  private lastOcrText: string | null = null
  private ocrBusy = false
  private lastOcrTime = 0
  private readonly OCR_INTERVAL_MS = 500

  // ── Loading ───────────────────────────────────────────────────────────────

  async tryLoadEmbeddings(classIds: string[]): Promise<boolean> {
    this.classIds = classIds
    const [extractor, all] = await Promise.all([
      loadFeatureExtractor(),
      getAllEmbeddings(),
      preloadDetector(),
    ])
    this.extractor = extractor
    this.storedEmbeddings = all.filter((e) => classIds.includes(e.classId))
    if (this.storedEmbeddings.length > 0) {
      this.mode = 'embeddings'
      return true
    }
    return false
  }

  async load(artifacts: unknown, classIds: string[]): Promise<void> {
    this.classIds = classIds
    const [extractor] = await Promise.all([
      loadFeatureExtractor(),
      preloadDetector(),
    ])
    this.extractor = extractor
    this.model = await deserializeModel(artifacts)
    this.mode = 'classifier'
  }

  async refreshEmbeddings(): Promise<void> {
    if (this.mode !== 'embeddings') return
    const all = await getAllEmbeddings()
    this.storedEmbeddings = all.filter((e) => this.classIds.includes(e.classId))
  }

  get currentMode(): InferenceMode {
    return this.mode
  }

  isLoaded(): boolean {
    return this.extractor !== null && (this.storedEmbeddings.length > 0 || this.model !== null)
  }

  // ── OCR hint (called by useInference after each frame) ────────────────────

  /**
   * Propagate the OCR signal from the hook back into the engine so that the
   * next prescore cycle can boost candidates whose best-matching class matches
   * the OCR hint.
   */
  setOcrHint(classId: string | null, score: number): void {
    this.ocrHintClassId = classId
    this.ocrHintScore = score
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  /**
   * Select the best candidate for this frame using temporal tracking.
   * Maintains a "lock" on the current candidate to avoid jitter when multiple
   * objects are visible. Releases the lock when:
   *   - The locked bbox no longer overlaps any current detection (IoU < CONTINUITY_IOU)
   *   - A significantly better candidate appears after LOCK_MIN_FRAMES hold
   *   - The embedding signal stays weak for WEAK_SIG_THRESHOLD frames
   */
  private selectCandidate(ranked: ScoredCandidate[]): ScoredCandidate | null {
    if (ranked.length === 0) {
      this.lockedCandidate = null
      this.lockedFrames = 0
      this.weakSigFrames = 0
      return null
    }

    const top = ranked[0]

    // No existing lock — start fresh
    if (!this.lockedCandidate) {
      this.lockedCandidate = top
      this.lockedFrames = 1
      this.weakSigFrames = 0
      return top
    }

    // Check if the locked bbox is still visible via IoU
    const stillVisible = ranked.find(
      (c) => bboxIoU(c.normBbox, this.lockedCandidate!.normBbox) >= CONTINUITY_IOU
    )

    if (stillVisible) {
      this.lockedFrames++

      // After hold period, switch if a clearly better candidate exists
      if (this.lockedFrames >= LOCK_MIN_FRAMES && top !== stillVisible) {
        const lockedScore = stillVisible.finalScore
        if (top.finalScore > lockedScore + SWITCH_THRESHOLD) {
          this.lockedCandidate = top
          this.lockedFrames = 1
          this.weakSigFrames = 0
          return top
        }
      }

      return stillVisible
    }

    // Locked bbox disappeared — switch to the new top candidate
    this.lockedCandidate = top
    this.lockedFrames = 1
    this.weakSigFrames = 0
    return top
  }

  // ── Prescore ──────────────────────────────────────────────────────────────

  /**
   * Round a normalized bbox to a 5% grid for use as a stable cache key.
   * Two bboxes that are within ~2.5% of each other map to the same key.
   */
  private bboxKey(nb: [number, number, number, number]): string {
    return nb.map((v) => (Math.round(v * 20) / 20).toFixed(2)).join(',')
  }

  /**
   * Generate embeddings for the top-N spatially ranked candidates and assign
   * embeddingScore + ocrScore to each. Updates prescoredEmbeddings cache.
   * Only called in embeddings mode when the lock is unstable or every PRESCORE_INTERVAL frames.
   */
  private async prescoreTopCandidates(
    topN: ScoredCandidate[],
    rawCanvas: HTMLCanvasElement,
  ): Promise<void> {
    this.prescoredEmbeddings.clear()

    for (const candidate of topN) {
      const [bx, by, bw, bh] = candidate.detection.bbox
      const crop = squareCropCanvas(rawCanvas, bx, by, bw, bh, 0.20, 224)

      const embedding = await generateEmbedding(crop)
      const matches = findBestMatches(embedding, this.storedEmbeddings)
      const bestMatch = matches[0]

      candidate.embeddingScore = bestMatch?.similarity ?? 0
      candidate.prescored = true

      // OCR score: only if the best-matching class matches the OCR hint
      if (
        bestMatch &&
        this.ocrHintClassId !== null &&
        bestMatch.classId === this.ocrHintClassId &&
        this.ocrHintScore > 0
      ) {
        candidate.ocrScore = this.ocrHintScore
      } else {
        candidate.ocrScore = 0
      }

      const key = this.bboxKey(candidate.normBbox)
      this.prescoredEmbeddings.set(key, embedding)
    }
  }

  // ── OCR (fire-and-forget, rate-limited) ───────────────────────────────────

  private async runOcrAsync(bbox: [number, number, number, number]): Promise<void> {
    if (!this.videoEl || this.ocrBusy) return
    this.ocrBusy = true
    this.lastOcrTime = Date.now()
    try {
      const vw = this.videoEl.videoWidth
      const vh = this.videoEl.videoHeight
      const [bx, by, bw, bh] = bbox
      const srcX = bx * vw, srcY = by * vh, srcW = bw * vw, srcH = bh * vh
      const scale = Math.max(1, 400 / srcW)
      const tW = Math.round(srcW * scale)
      const tH = Math.round(srcH * scale)
      const ocrCanvas = document.createElement('canvas')
      ocrCanvas.width = tW
      ocrCanvas.height = tH
      ocrCanvas.getContext('2d')!.drawImage(this.videoEl, srcX, srcY, srcW, srcH, 0, 0, tW, tH)
      const text = await extractText(ocrCanvas)
      this.lastOcrText = text || null
    } catch {
      // non-fatal
    } finally {
      this.ocrBusy = false
    }
  }

  // ── Frame loop ────────────────────────────────────────────────────────────

  start(
    videoEl: HTMLVideoElement,
    onFrame: (result: FrameResult) => void,
    onFps: (fps: number) => void,
    onError?: (msg: string) => void
  ) {
    if (this.rafId !== null) this.stop()
    this.smoother.reset()
    this.videoEl = videoEl
    this.lockedCandidate = null
    this.lockedFrames = 0
    this.weakSigFrames = 0
    this.lastOcrText = null
    this.ocrBusy = false
    this.lastOcrTime = 0
    this.prescoredEmbeddings.clear()
    this.ocrHintClassId = null
    this.ocrHintScore = 0

    const emitEmpty = (candidates: CandidateInfo[] = []) => {
      onFrame({
        stable: null,
        bestGuess: null,
        detection: null,
        cropThumbnail: null,
        cropMethod: 'cocoSsd',
        requiredStreak: REQUIRED_STREAK,
        mode: this.mode,
        ocrText: this.lastOcrText,
        candidates,
        lockedFrames: 0,
      })
    }

    const loop = async () => {
      if (!this.extractor || videoEl.readyState < 2) {
        this.rafId = requestAnimationFrame(loop)
        return
      }

      try {
        // ── Capture 224×224 center-square ────────────────────────────────
        const rawCanvas = document.createElement('canvas')
        rawCanvas.width = 224
        rawCanvas.height = 224
        const rawCtx = rawCanvas.getContext('2d')!
        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight
        const size = Math.min(vw, vh)
        rawCtx.drawImage(videoEl, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 224, 224)

        // ── Multi-candidate COCO detection + spatial ranking ──────────────
        const rawDetections = await detectAllObjects(rawCanvas)
        const ranked = rankCandidates(rawDetections, 224, 224)

        // ── Gate: no valid candidate ──────────────────────────────────────
        if (ranked.length === 0) {
          this.smoother.reset()
          this.lockedCandidate = null
          this.lockedFrames = 0
          this.weakSigFrames = 0
          this.prescoredEmbeddings.clear()
          emitEmpty()
          this.rafId = requestAnimationFrame(loop)
          return
        }

        // ── Prescore: embed + OCR top candidates when useful ──────────────
        const isLockStable = this.lockedCandidate !== null && this.weakSigFrames === 0
        const atInterval = this.lockedFrames > 0 && this.lockedFrames % PRESCORE_INTERVAL === 0
        const shouldPrescore =
          this.mode === 'embeddings' &&
          this.storedEmbeddings.length > 0 &&
          ranked.length > 1 &&
          (!isLockStable || atInterval)

        if (shouldPrescore) {
          const topN = ranked.slice(0, MAX_PRESCORE_CANDIDATES)
          await this.prescoreTopCandidates(topN, rawCanvas)
          rerankAfterPrescore(ranked)
        }

        // ── Temporal tracking: select winner ──────────────────────────────
        const selected = this.selectCandidate(ranked)!

        // ── OCR async (rate-limited, non-blocking) ────────────────────────
        if (!this.ocrBusy && Date.now() - this.lastOcrTime >= this.OCR_INTERVAL_MS) {
          void this.runOcrAsync(selected.normBbox)
        }

        // ── Build crop from selected candidate ────────────────────────────
        const [bx, by, bw, bh] = selected.detection.bbox   // pixel coords in 224×224
        const cropCanvas = squareCropCanvas(rawCanvas, bx, by, bw, bh, 0.20, 224)
        const cropThumbnail = cropCanvas.toDataURL('image/jpeg', 0.75)

        const detection: DetectionInfo = {
          bbox: selected.normBbox,
          score: selected.detection.score,
          label: selected.detection.label,
        }

        // ── Embedding / classifier inference ──────────────────────────────
        let probs: number[]
        let maxIdx: number
        let maxConf: number

        if (this.mode === 'embeddings' && this.storedEmbeddings.length > 0) {
          // Reuse cached embedding from prescore if available
          const key = this.bboxKey(selected.normBbox)
          const cachedVec = this.prescoredEmbeddings.get(key)
          const query = cachedVec ?? await generateEmbedding(cropCanvas)
          const matches = findBestMatches(query, this.storedEmbeddings)
          probs = this.classIds.map((id) => matches.find((m) => m.classId === id)?.similarity ?? 0)
          maxIdx = probs.indexOf(Math.max(...probs))
          maxConf = probs[maxIdx]
        } else if (this.model) {
          const tensor = tf.tidy(() =>
            (tf.browser.fromPixels(cropCanvas) as tf.Tensor3D).expandDims(0).toFloat().div(255)
          )
          const embeddings = this.extractor!.infer(tensor as tf.Tensor<tf.Rank>, true) as tf.Tensor
          const features = Array.from((await embeddings.data()) as Float32Array)
          tf.dispose([tensor, embeddings])

          const input = tf.tensor2d([features])
          const output = this.model.predict(input) as tf.Tensor
          probs = Array.from((await output.data()) as Float32Array)
          tf.dispose([input, output])

          maxIdx = probs.indexOf(Math.max(...probs))
          maxConf = probs[maxIdx]
        } else {
          this.rafId = requestAnimationFrame(loop)
          return
        }

        // ── Embedding quality feedback for tracking ───────────────────────
        if (this.mode === 'embeddings') {
          if (maxConf < WEAK_SIG_MIN) {
            this.weakSigFrames++
            if (this.weakSigFrames >= WEAK_SIG_THRESHOLD && ranked.length > 1) {
              this.lockedCandidate = null
              this.lockedFrames = 0
              this.weakSigFrames = 0
              this.prescoredEmbeddings.clear()
            }
          } else {
            this.weakSigFrames = 0
          }
        }

        // ── Stability tracking ────────────────────────────────────────────
        this.smoother.push(maxIdx, maxConf, probs)
        const stable = this.smoother.getStable()
        const bestGuess = this.smoother.getBestGuess()!

        // ── Build CandidateInfo array for debug ───────────────────────────
        const candidates: CandidateInfo[] = ranked.map((c) => ({
          normBbox: c.normBbox,
          label: c.detection.label,
          centerScore: c.centerScore,
          areaScore: c.areaScore,
          detectorScore: c.detectorScore,
          embeddingScore: c.embeddingScore,
          ocrScore: c.ocrScore,
          prescored: c.prescored,
          finalScore: c.finalScore,
          isLocked: c === selected,
        }))

        onFrame({
          stable: stable
            ? { classId: this.classIds[stable.classIndex], avgConfidence: stable.avgConfidence, streak: stable.streak }
            : null,
          bestGuess: {
            classId: this.classIds[bestGuess.classIndex],
            confidence: bestGuess.confidence,
            streak: bestGuess.streak,
            allProbs: bestGuess.allProbs,
          },
          detection,
          cropThumbnail,
          cropMethod: 'cocoSsd',
          requiredStreak: REQUIRED_STREAK,
          mode: this.mode,
          ocrText: this.lastOcrText,
          candidates,
          lockedFrames: this.lockedFrames,
        })

        // FPS counter
        this.frameCount++
        const now = Date.now()
        if (now - this.lastFpsTime >= 1000) {
          onFps(this.frameCount)
          this.frameCount = 0
          this.lastFpsTime = now
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[InferenceEngine]', msg)
        onError?.(msg)
      }

      this.rafId = requestAnimationFrame(loop)
    }

    this.lastFpsTime = Date.now()
    this.rafId = requestAnimationFrame(loop)
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.smoother.reset()
    this.lockedCandidate = null
    this.lockedFrames = 0
    this.weakSigFrames = 0
    this.lastOcrText = null
    this.ocrBusy = false
    this.videoEl = null
    this.prescoredEmbeddings.clear()
    this.ocrHintClassId = null
    this.ocrHintScore = 0
  }
}

export const inferenceEngine = new InferenceEngine()
