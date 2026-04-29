/**
 * INFERENCE ENGINE
 *
 * Two modes, selected at load time:
 *
 *   'embeddings' (primary)
 *     COCO-SSD → crop → MobileNet embedding → cosine similarity search
 *     against stored per-sample embeddings → stability tracking → result.
 *     No trained classifier needed. Adding new samples updates the index
 *     instantly with no re-training.
 *
 *   'classifier' (fallback)
 *     COCO-SSD → crop → MobileNet features → trained Dense head → softmax.
 *     Used when no embeddings exist in IDB.
 *
 * The FrameResult shape is identical in both modes:
 *   stable.avgConfidence / bestGuess.confidence = similarity (0–1) in embedding
 *   mode, softmax probability in classifier mode.
 *   bestGuess.allProbs = per-class similarities or per-class softmax.
 */

import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'
import { deserializeModel } from '@/features/training/modelSerializer'
import { PredictionSmoother, REQUIRED_STREAK } from './predictionSmoothing'
import { detectAndCrop, preloadDetector } from '@/features/segmentation/objectCropper'
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

export interface FrameResult {
  stable: { classId: string; avgConfidence: number; streak: number } | null
  bestGuess: { classId: string; confidence: number; streak: number; allProbs: number[] } | null
  detection: DetectionInfo | null
  cropThumbnail: string | null
  cropMethod: string
  requiredStreak: number
  mode: InferenceMode
  /** Last OCR result from the object crop. Updated every ~500ms, null if not yet run. */
  ocrText: string | null
}

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

  // ── OCR (decoupled, rate-limited to ~2fps) ───────────────────────────────
  private videoEl: HTMLVideoElement | null = null
  private lastOcrText: string | null = null
  private ocrBusy = false
  private lastOcrTime = 0
  private readonly OCR_INTERVAL_MS = 500

  // ── Loading ──────────────────────────────────────────────────────────────

  /**
   * Primary load path: embeddings mode.
   * Returns true if at least one embedding was found for the given classIds.
   * Also preloads COCO-SSD and the MobileNet extractor.
   */
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

  /**
   * Fallback load path: classifier mode.
   * Deserializes the Dense head from IDB artifacts.
   */
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

  /** Reload embeddings in-place (called after new captures without restarting inference). */
  async refreshEmbeddings(): Promise<void> {
    if (this.mode !== 'embeddings') return
    const all = await getAllEmbeddings()
    this.storedEmbeddings = all.filter((e) => this.classIds.includes(e.classId))
  }

  get currentMode(): InferenceMode {
    return this.mode
  }

  // ── Frame loop ───────────────────────────────────────────────────────────

  start(
    videoEl: HTMLVideoElement,
    onFrame: (result: FrameResult) => void,
    onFps: (fps: number) => void,
    onError?: (msg: string) => void
  ) {
    if (this.rafId !== null) this.stop()
    this.smoother.reset()
    this.videoEl = videoEl
    this.lastOcrText = null
    this.ocrBusy = false
    this.lastOcrTime = 0

    const loop = async () => {
      if (!this.extractor || videoEl.readyState < 2) {
        this.rafId = requestAnimationFrame(loop)
        return
      }

      try {
        // ── Capture 224×224 center-square ─────────────────────────────
        const rawCanvas = document.createElement('canvas')
        rawCanvas.width = 224
        rawCanvas.height = 224
        const rawCtx = rawCanvas.getContext('2d')!
        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight
        const size = Math.min(vw, vh)
        rawCtx.drawImage(videoEl, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 224, 224)
        const rawImageData = rawCtx.getImageData(0, 0, 224, 224)

        // ── COCO-SSD detection + crop ─────────────────────────────────
        const cropResult = await detectAndCrop(rawImageData)
        const { cropInfo } = cropResult

        // ── Gate: no real object → skip classification ────────────────
        if (cropInfo.method !== 'cocoSsd') {
          this.smoother.reset()
          onFrame({
            stable: null,
            bestGuess: null,
            detection: null,
            cropThumbnail: null,
            cropMethod: cropInfo.method,
            requiredStreak: REQUIRED_STREAK,
            mode: this.mode,
            ocrText: this.lastOcrText,
          })
          this.rafId = requestAnimationFrame(loop)
          return
        }

        // ── Fire OCR async (rate-limited, non-blocking) ───────────────
        if (!this.ocrBusy && Date.now() - this.lastOcrTime >= this.OCR_INTERVAL_MS) {
          void this.runOcrAsync(cropInfo.bbox!)
        }

        const detection: DetectionInfo = {
          bbox: cropInfo.bbox!,
          score: cropInfo.confidence,
          label: cropInfo.label ?? '',
        }

        // Build crop canvas (shared by both paths)
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = 224
        cropCanvas.height = 224
        cropCanvas.getContext('2d')!.putImageData(cropResult.imageData, 0, 0)

        let probs: number[]
        let maxIdx: number
        let maxConf: number

        if (this.mode === 'embeddings' && this.storedEmbeddings.length > 0) {
          // ── Embeddings path ─────────────────────────────────────────
          const query = await generateEmbedding(cropCanvas)
          const matches = findBestMatches(query, this.storedEmbeddings)

          // Map to per-class array in classIds order
          probs = this.classIds.map((id) => matches.find((m) => m.classId === id)?.similarity ?? 0)
          maxIdx = probs.indexOf(Math.max(...probs))
          maxConf = probs[maxIdx]
        } else if (this.model) {
          // ── Classifier path (fallback) ──────────────────────────────
          const tensor = tf.tidy(() =>
            (tf.browser.fromPixels(cropCanvas) as tf.Tensor3D).expandDims(0).toFloat().div(255)
          )
          const embeddings = this.extractor.infer(tensor as tf.Tensor<tf.Rank>, true) as tf.Tensor
          const features = Array.from((await embeddings.data()) as Float32Array)
          tf.dispose([tensor, embeddings])

          const input = tf.tensor2d([features])
          const output = this.model.predict(input) as tf.Tensor
          probs = Array.from((await output.data()) as Float32Array)
          tf.dispose([input, output])

          maxIdx = probs.indexOf(Math.max(...probs))
          maxConf = probs[maxIdx]
        } else {
          // No mode available
          this.rafId = requestAnimationFrame(loop)
          return
        }

        // ── Stability tracking (shared) ─────────────────────────────
        this.smoother.push(maxIdx, maxConf, probs)
        const stable = this.smoother.getStable()
        const bestGuess = this.smoother.getBestGuess()!

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
          cropThumbnail: cropResult.thumbnail,
          cropMethod: cropInfo.method,
          requiredStreak: REQUIRED_STREAK,
          mode: this.mode,
          ocrText: this.lastOcrText,
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
    this.lastOcrText = null
    this.ocrBusy = false
    this.videoEl = null
  }

  /** Fire OCR on a fresh native-resolution crop. Never called with await — runs independently. */
  private async runOcrAsync(bbox: [number, number, number, number]): Promise<void> {
    if (!this.videoEl || this.ocrBusy) return
    this.ocrBusy = true
    this.lastOcrTime = Date.now()
    try {
      const vw = this.videoEl.videoWidth
      const vh = this.videoEl.videoHeight
      const [bx, by, bw, bh] = bbox
      const srcX = bx * vw, srcY = by * vh, srcW = bw * vw, srcH = bh * vh
      // Target at least 400px wide so Tesseract can read small text
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
      // OCR failure is non-fatal; keep last known text
    } finally {
      this.ocrBusy = false
    }
  }

  isLoaded() {
    return this.extractor !== null && (this.storedEmbeddings.length > 0 || this.model !== null)
  }
}

export const inferenceEngine = new InferenceEngine()
