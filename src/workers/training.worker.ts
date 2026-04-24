import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor, extractFeaturesFromBatch } from '@/features/training/featureExtractor'
import { buildClassifier, trainClassifier } from '@/features/training/classifier'
import { serializeModel } from '@/features/training/modelSerializer'
import { getSamplesByClass } from '@/features/storage/samplesStore'
import type { TrainingConfig, TrainingProgress, TrainingResult } from '@/types/training.types'

self.onmessage = async (e: MessageEvent) => {
  const { type, classIds, config } = e.data as {
    type: 'START'
    classIds: string[]
    config: TrainingConfig
  }

  if (type !== 'START') return

  const postProgress = (p: TrainingProgress) =>
    self.postMessage({ type: 'PROGRESS', progress: p })

  try {
    // 1. Load samples from IDB
    postProgress({
      status: 'extracting_features',
      currentEpoch: 0,
      totalEpochs: config.epochs,
      metrics: [],
      message: 'Cargando muestras...',
    })

    const allBlobs: Blob[] = []
    const allLabels: number[] = []

    for (let i = 0; i < classIds.length; i++) {
      const samples = await getSamplesByClass(classIds[i])
      for (const s of samples) {
        allBlobs.push(s.blob)
        allLabels.push(i)
      }
    }

    if (allBlobs.length === 0) {
      self.postMessage({ type: 'ERROR', error: 'No hay muestras para entrenar' })
      return
    }

    // 2. Extract features
    const extractor = await loadFeatureExtractor((msg) => {
      postProgress({
        status: 'extracting_features',
        currentEpoch: 0,
        totalEpochs: config.epochs,
        metrics: [],
        message: msg,
      })
    })

    const features = await extractFeaturesFromBatch(allBlobs, extractor, (done, total) => {
      postProgress({
        status: 'extracting_features',
        currentEpoch: 0,
        totalEpochs: config.epochs,
        metrics: [],
        message: `Extrayendo features: ${done}/${total}`,
      })
    })

    // 3. Train
    const model = buildClassifier(classIds.length, features[0].length)
    const metrics: TrainingProgress['metrics'] = []

    postProgress({
      status: 'training',
      currentEpoch: 0,
      totalEpochs: config.epochs,
      metrics: [],
      message: 'Entrenando...',
    })

    await trainClassifier(model, features, allLabels, classIds.length, config, (epochMetrics) => {
      metrics.push(epochMetrics)
      postProgress({
        status: 'training',
        currentEpoch: epochMetrics.epoch,
        totalEpochs: config.epochs,
        metrics: [...metrics],
        message: `Epoch ${epochMetrics.epoch}/${config.epochs} — loss: ${epochMetrics.loss.toFixed(4)} acc: ${(epochMetrics.accuracy * 100).toFixed(1)}%`,
      })
    })

    // 4. Serialize
    postProgress({
      status: 'saving',
      currentEpoch: config.epochs,
      totalEpochs: config.epochs,
      metrics,
      message: 'Guardando modelo...',
    })

    const artifacts = await serializeModel(model)
    const lastMetric = metrics[metrics.length - 1]

    const result: TrainingResult = {
      modelArtifacts: artifacts,
      classIds,
      finalAccuracy: lastMetric?.accuracy ?? 0,
      finalLoss: lastMetric?.loss ?? 0,
      trainedAt: Date.now(),
    }

    model.dispose()
    self.postMessage({ type: 'DONE', result })
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : 'Error desconocido',
    })
  }
}
