/**
 * INFERENCE ENGINE
 *
 * Frame pipeline (must mirror the training preprocessing exactly):
 *   1. Capture raw 224×224 square crop from video
 *   2. detectAndCrop() → same object-isolation preprocessing used at capture time
 *      (COCO-SSD → saliency → center fallback)
 *   3. canvas → tf.Tensor directly (no blob/bitmap roundtrip, avoids OffscreenCanvas compat issues)
 *   4. MobileNet feature extraction
 *   5. Classifier predict → all class probabilities
 *   6. Temporal smoothing (5-frame window)
 */

import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'
import { deserializeModel } from '@/features/training/modelSerializer'
import { PredictionSmoother } from './predictionSmoothing'
// --- Object segmentation preprocessing (must match training pipeline) ---
import {
  detectAndCrop,
  preloadDetector,
} from '@/features/segmentation/objectCropper'
import type { DetectionResult } from '@/types/inference.types'

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

    // Load feature extractor and COCO-SSD detector in parallel.
    // COCO-SSD must be preloaded here so inference frames get the same
    // object-crop preprocessing that was applied during training capture.
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
    onDetection: (result: DetectionResult | null) => void,
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
        // ── Step 1: Capture raw 224×224 square from video ──────────────────
        const rawCanvas = document.createElement('canvas')
        rawCanvas.width = 224
        rawCanvas.height = 224
        const rawCtx = rawCanvas.getContext('2d')!
        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight
        const size = Math.min(vw, vh)
        const ox = (vw - size) / 2
        const oy = (vh - size) / 2
        rawCtx.drawImage(videoEl, ox, oy, size, size, 0, 0, 224, 224)
        const rawImageData = rawCtx.getImageData(0, 0, 224, 224)

        // ── Step 2: Object-crop preprocessing (mirrors training pipeline) ──
        // detectAndCrop() applies COCO-SSD → saliency → center fallback,
        // exactly as useCapture.ts does during sample collection.
        const cropResult = await detectAndCrop(rawImageData)

        // ── Step 3: Canvas → tensor (no blob/bitmap roundtrip) ────────────
        // Using a regular canvas avoids OffscreenCanvas compatibility issues
        // in the main thread on some mobile browsers.
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

        // ── Step 4: Feature extraction ─────────────────────────────────────
        // infer(tensor, true) returns the penultimate-layer 1024-dim embedding
        const embeddings = this.extractor.infer(
          tensor as tf.Tensor<tf.Rank>,
          true
        ) as tf.Tensor
        const features = Array.from((await embeddings.data()) as Float32Array)
        tf.dispose([tensor, embeddings])

        // ── Step 5: Classify ───────────────────────────────────────────────
        const input = tf.tensor2d([features])
        const output = this.model.predict(input) as tf.Tensor
        const probs = Array.from((await output.data()) as Float32Array)
        tf.dispose([input, output])

        // ── Step 6: Smooth + emit ──────────────────────────────────────────
        const maxIdx = probs.indexOf(Math.max(...probs))
        const maxConf = probs[maxIdx]

        this.smoother.push(maxIdx, maxConf)
        const smoothed = this.smoother.getSmoothed()

        if (smoothed) {
          onDetection({
            classId: this.classIds[smoothed.classIndex],
            className: '',          // filled in by useInference from store
            confidence: smoothed.confidence,
            timestamp: Date.now(),
            isAboveThreshold: true, // threshold check done in useInference
            allProbabilities: probs,
            cropMethod: cropResult.cropInfo.method,
          })
        }

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
        // Continue loop — don't stop on a single frame error
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

// Singleton used by useInference
export const inferenceEngine = new InferenceEngine()
