import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'

let model: mobilenet.MobileNet | null = null

export async function loadFeatureExtractor(
  onProgress?: (msg: string) => void
): Promise<mobilenet.MobileNet> {
  if (model) return model
  onProgress?.('Cargando MobileNet...')
  model = await mobilenet.load({ version: 2, alpha: 1.0 })
  onProgress?.('MobileNet listo')
  return model
}

export async function extractFeatures(
  blob: Blob,
  extractor: mobilenet.MobileNet
): Promise<Float32Array> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(224, 224)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0, 224, 224)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, 224, 224)
  const tensor = tf.tidy(() => {
    const uint8 = new Uint8Array(imageData.data.buffer)
    const t = tf.browser.fromPixels({ data: uint8, width: 224, height: 224 })
    return t.expandDims(0).toFloat().div(255)
  })

  // Use infer() to get embeddings from the penultimate layer
  const embeddings = extractor.infer(tensor as tf.Tensor<tf.Rank>, true) as tf.Tensor
  const data = await embeddings.data() as Float32Array
  tf.dispose([tensor, embeddings])
  return data
}

export async function extractFeaturesFromBatch(
  blobs: Blob[],
  extractor: mobilenet.MobileNet,
  onProgress?: (done: number, total: number) => void
): Promise<Float32Array[]> {
  const features: Float32Array[] = []
  for (let i = 0; i < blobs.length; i++) {
    features.push(await extractFeatures(blobs[i], extractor))
    onProgress?.(i + 1, blobs.length)
  }
  return features
}
