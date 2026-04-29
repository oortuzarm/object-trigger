/**
 * INFERENCE ENGINE
 *
 * Frame pipeline:
 *   1. Capture raw 224×224 square from video
 *   2. detectAndCrop() — COCO-SSD detects bounding box; saliency/center as fallback
 *   3. GATE: if COCO-SSD did not find an object (method !== 'cocoSsd'), reset
 *      the streak smoother and emit a "no detection" frame — classifier never runs.
 *   4. Canvas → tf.Tensor (no blob/bitmap roundtrip)
 *   5. MobileNet feature extraction
 *   6. Classifier predict → all class probabilities
 *   7. PredictionSmoother → stable detection OR best-guess debug data
 *
 * The gate in step 3 is the key difference from a pure classifier: the model
 * will only produce a prediction when COCO-SSD confirms a real object in frame.
 */

import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'
import { deserializeModel } from '@/features/training/modelSerializer'
import { PredictionSmoother, REQUIRED_STREAK } from './predictionSmoothing'
import {
  detectAndCrop,
  preloadDetector,
} from '@/features/segmentation/objectCropper'

export interface DetectionInfo {
  /** Normalized [x, y, w, h] 0-1 relative to the captured 224×224 frame. */
  bbox: [number, number, number, number]
  /** COCO-SSD confidence score 0-1. */
  score: number
  /** COCO class name (e.g. "bottle", "person"). */
  label: string
}

export interface FrameResult {
  /** Non-null only when streak + confidence floor are both met. */
  stable: { classId: string; avgConfidence: number; streak: number } | null
  /**
   * Always set when COCO-SSD found an object (even before streak is met).
   * null when no object was detected → classifier did not run.
   */
  bestGuess: { classId: string; confidence: number; streak: number; allProbs: number[] } | null
  /** COCO-SSD detection result. null when no object found. */
  detection: DetectionInfo | null
  /** JPEG data-URL of the 224×224 crop actually sent to the classifier. null when no detection. */
  cropThumbnail: string | null
  cropMethod: string
  requiredStreak: number
}

export class InferenceEngine {
  private model: tf.LayersModel | null = null
  private extractor: Awaited<ReturnType<typeof loadFeatureExtractor>> | null = null
  private classIds: string[] = []
  private smoother = new PredictionSmoother()
  private rafId: number | null = null
  private frameCount = 0
  private lastFpsTime = 0

  async load(
    artifacts: unknown,
    classIds: string[],
    onReady?: () => void
  ): Promise<void> {
    this.classIds = classIds

    const [extractor] = await Promise.all([
      loadFeatureExtractor(),
      preloadDetector(),
    ])
    this.extractor = extractor
    this.model = await deserializeModel(artifacts)
    onReady?.()
  }

  start(
    videoEl: HTMLVideoElement,
    onFrame: (result: FrameResult) => void,
    onFps: (fps: number) => void,
    onError?: (msg: string) => void
  ) {
    if (this.rafId !== null) this.stop()
    this.smoother.reset()

    const loop = async () => {
      if (!this.model || !this.extractor || videoEl.readyState < 2) {
        this.rafId = requestAnimationFrame(loop)
        return
      }

      try {
        // ── Step 1: Capture raw 224×224 center-square from video ─────────
        const rawCanvas = document.createElement('canvas')
        rawCanvas.width = 224
        rawCanvas.height = 224
        const rawCtx = rawCanvas.getContext('2d')!
        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight
        const size = Math.min(vw, vh)
        rawCtx.drawImage(videoEl, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 224, 224)
        const rawImageData = rawCtx.getImageData(0, 0, 224, 224)

        // ── Step 2: COCO-SSD detection + crop ────────────────────────────
        const cropResult = await detectAndCrop(rawImageData)
        const { cropInfo } = cropResult

        // ── Step 3: GATE — skip classifier when no real object detected ──
        if (cropInfo.method !== 'cocoSsd') {
          this.smoother.reset()
          onFrame({
            stable: null,
            bestGuess: null,
            detection: null,
            cropThumbnail: null,
            cropMethod: cropInfo.method,
            requiredStreak: REQUIRED_STREAK,
          })
          this.rafId = requestAnimationFrame(loop)
          return
        }

        const detection: DetectionInfo = {
          bbox: cropInfo.bbox!,
          score: cropInfo.confidence,
          label: cropInfo.label ?? '',
        }

        // ── Step 4: Canvas → tensor ───────────────────────────────────────
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = 224
        cropCanvas.height = 224
        cropCanvas.getContext('2d')!.putImageData(cropResult.imageData, 0, 0)

        const tensor = tf.tidy(() =>
          (tf.browser.fromPixels(cropCanvas) as tf.Tensor3D)
            .expandDims(0)
            .toFloat()
            .div(255)
        )

        // ── Step 5: Feature extraction ────────────────────────────────────
        const embeddings = this.extractor.infer(
          tensor as tf.Tensor<tf.Rank>,
          true
        ) as tf.Tensor
        const features = Array.from((await embeddings.data()) as Float32Array)
        tf.dispose([tensor, embeddings])

        // ── Step 6: Classify ──────────────────────────────────────────────
        const input = tf.tensor2d([features])
        const output = this.model.predict(input) as tf.Tensor
        const probs = Array.from((await output.data()) as Float32Array)
        tf.dispose([input, output])

        // ── Step 7: Stability tracking ────────────────────────────────────
        const maxIdx = probs.indexOf(Math.max(...probs))
        const maxConf = probs[maxIdx]

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
        })

        // FPS
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
  }

  isLoaded() {
    return this.model !== null && this.extractor !== null
  }
}

export const inferenceEngine = new InferenceEngine()
