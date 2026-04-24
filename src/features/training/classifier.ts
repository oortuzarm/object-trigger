import * as tf from '@tensorflow/tfjs'
import type { TrainingConfig, EpochMetrics } from '@/types/training.types'

export function buildClassifier(numClasses: number, featureDim = 1024): tf.Sequential {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [featureDim],
        units: 256,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      }),
      tf.layers.dropout({ rate: 0.4 }),
      tf.layers.dense({
        units: numClasses,
        activation: 'softmax',
      }),
    ],
  })

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  })

  return model
}

export async function trainClassifier(
  model: tf.Sequential,
  features: Float32Array[],
  labels: number[],
  numClasses: number,
  config: TrainingConfig,
  onEpoch: (metrics: EpochMetrics) => void
): Promise<void> {
  const featureDim = features[0].length

  const xs = tf.tensor2d(features.map((f) => Array.from(f)), [features.length, featureDim])
  const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses)

  await model.fit(xs, ys, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationSplit: config.validationSplit,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        onEpoch({
          epoch: epoch + 1,
          loss: logs?.loss ?? 0,
          accuracy: logs?.acc ?? logs?.accuracy ?? 0,
          valLoss: logs?.val_loss,
          valAccuracy: logs?.val_acc ?? logs?.val_accuracy,
        })
      },
    },
  })

  tf.dispose([xs, ys])
}

export async function predict(
  model: tf.Sequential,
  features: Float32Array
): Promise<Float32Array> {
  const input = tf.tensor2d([Array.from(features)])
  const output = model.predict(input) as tf.Tensor
  const probs = (await output.data()) as Float32Array
  tf.dispose([input, output])
  return probs
}
