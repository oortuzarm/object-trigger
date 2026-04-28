/**
 * INFERENCE ENGINE
 *
 * Frame pipeline (must mirror training preprocessing exactly):
 *   1. Capture raw 224×224 square from video
 *   2. detectAndCrop() — same object-isolation pipeline used at capture time
 *   3. canvas → tf.Tensor directly (no blob/bitmap roundtrip)
 *   4. MobileNet feature extraction
 *   5. Classifier predict → all class probabilities
 *   6. PredictionSmoother → stable detection OR best-guess debug data
 *
 * The engine emits a FrameResult on every inference cycle.
 * CONFIRMED detections require REQUIRED_STREAK consecutive frames above the
 * confidence floor. Per-class threshold checking is done in useInference.ts.
 */

import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'
import { deserializeModel } from '@/features/training/modelSerializer'
import { PredictionSmoother, REQUIRED_STREAK } from './predictionSmoothing'
// --- Object segmentation preprocessing (must match training pipeline) ---
import {
  detectAndCrop,
  preloadDetector,
} from '@/features/segmentation/objectCropper'

export interface FrameResult {
  /** Non-null only when streak + confidence floor are both met. */
  stable: { classId: string; avgConfidence: number; streak: number } | null
  /** Always set — current frame's winner for debug display. */
  bestGuess: { classId: string; confidence: number; streak: number; allProbs: number[] }
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

    // Load feature extractor and COCO-SSD in parallel.
    // Both must be ready before the first inference frame.
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
        // ── Step 1: Capture raw 224×224 square from video ────────────────
        const rawCanvas = document.createElement('canvas')
        rawCanvas.width = 224
        rawCanvas.height = 224
        const rawCtx = rawCanvas.getContext('2d')!
        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight
        const size = Math.min(vw, vh)
        rawCtx.drawImage(videoEl, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 224, 224)
        const rawImageData = rawCtx.getImageData(0, 0, 224, 224)

        // ── Step 2: Object-crop preprocessing (mirrors training) ─────────
        const cropResult = await detectAndCrop(rawImageData)

        // ── Step 3: Canvas → tensor (avoids OffscreenCanvas compat issues)
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

        // ── Step 4: Feature extraction ───────────────────────────────────
        const embeddings = this.extractor.infer(
          tensor as tf.Tensor<tf.Rank>,
          true
        ) as tf.Tensor
        const features = Array.from((await embeddings.data()) as Float32Array)
        tf.dispose([tensor, embeddings])

        // ── Step 5: Classify ─────────────────────────────────────────────
        const input = tf.tensor2d([features])
        const output = this.model.predict(input) as tf.Tensor
        const probs = Array.from((await output.data()) as Float32Array)
        tf.dispose([input, output])

        // ── Step 6: Stability tracking ───────────────────────────────────
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
          cropMethod: cropResult.cropInfo.method,
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
