/**
 * EMBEDDING ENGINE
 *
 * Generates a 1024-dim L2-normalized feature vector from a 224×224 canvas
 * using the MobileNet v2 penultimate layer — the same extractor used for
 * training. Normalizing to unit-length makes cosine similarity = dot product,
 * which is fast and numerically stable.
 *
 * The singleton MobileNet model is shared with the inference engine so the
 * model loads once and is reused for both capture-time embedding generation
 * and real-time inference.
 */

import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'

/**
 * Generates a L2-normalized 1024-dim embedding from a 224×224 HTMLCanvasElement.
 * Consistent with inference pipeline: tf.browser.fromPixels → /255 → MobileNet infer.
 */
export async function generateEmbedding(canvas: HTMLCanvasElement): Promise<Float32Array> {
  const extractor = await loadFeatureExtractor()

  const tensor = tf.tidy(() =>
    (tf.browser.fromPixels(canvas) as tf.Tensor3D)
      .expandDims(0)
      .toFloat()
      .div(255)
  )

  const embeddings = extractor.infer(tensor as tf.Tensor<tf.Rank>, true) as tf.Tensor
  const raw = (await embeddings.data()) as Float32Array
  tf.dispose([tensor, embeddings])

  return l2Normalize(raw)
}

function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm)
  if (norm < 1e-10) return v
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm
  return out
}
