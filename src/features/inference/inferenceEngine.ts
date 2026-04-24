import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor, extractFeatures } from '@/features/training/featureExtractor'
import { deserializeModel } from '@/features/training/modelSerializer'
import { PredictionSmoother } from './predictionSmoothing'
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
    this.extractor = await loadFeatureExtractor()
    this.model = await deserializeModel(artifacts)
    onReady?.()
  }

  start(
    videoEl: HTMLVideoElement,
    onDetection: (result: DetectionResult | null) => void,
    onFps: (fps: number) => void
  ) {
    if (this.rafId !== null) this.stop()
    this.smoother.reset()

    const loop = async () => {
      if (!this.model || !this.extractor || videoEl.readyState < 2) {
        this.rafId = requestAnimationFrame(loop)
        return
      }

      try {
        // Capture frame
        const canvas = document.createElement('canvas')
        canvas.width = 224
        canvas.height = 224
        const ctx = canvas.getContext('2d')!
        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight
        const size = Math.min(vw, vh)
        const ox = (vw - size) / 2
        const oy = (vh - size) / 2
        ctx.drawImage(videoEl, ox, oy, size, size, 0, 0, 224, 224)
        const imageData = ctx.getImageData(0, 0, 224, 224)

        // Extract features + predict
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.8))
        const features = await extractFeatures(blob, this.extractor)

        const input = tf.tensor2d([Array.from(features)])
        const output = this.model.predict(input) as tf.Tensor
        const probs = Array.from((await output.data()) as Float32Array)
        tf.dispose([input, output])

        const maxIdx = probs.indexOf(Math.max(...probs))
        const maxConf = probs[maxIdx]

        this.smoother.push(maxIdx, maxConf)
        const smoothed = this.smoother.getSmoothed()

        if (smoothed) {
          onDetection({
            classId: this.classIds[smoothed.classIndex],
            className: '',   // filled in by hook from store
            confidence: smoothed.confidence,
            timestamp: Date.now(),
            isAboveThreshold: true,   // threshold checked in hook
          })
        }

        // FPS
        this.frameCount++
        const now = Date.now()
        if (now - this.lastFpsTime >= 1000) {
          onFps(this.frameCount)
          this.frameCount = 0
          this.lastFpsTime = now
        }
      } catch {
        // ignore individual frame errors
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

// Singleton
export const inferenceEngine = new InferenceEngine()
