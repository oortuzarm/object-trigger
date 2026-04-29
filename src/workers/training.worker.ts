import * as tf from '@tensorflow/tfjs'
import { loadFeatureExtractor, extractFeatures } from '@/features/training/featureExtractor'
import { buildClassifier, trainClassifier } from '@/features/training/classifier'
import { serializeModel } from '@/features/training/modelSerializer'
import { getSamplesByClass } from '@/features/storage/samplesStore'
import { getAugmentedBlobs } from '@/features/training/augmentation'
import type { TrainingConfig, TrainingProgress, TrainingResult, PerClassResult } from '@/types/training.types'

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
    // ── 1. Load all blobs from IDB ─────────────────────────────────────────
    postProgress({
      status: 'extracting_features',
      currentEpoch: 0,
      totalEpochs: config.epochs,
      metrics: [],
      message: 'Cargando muestras...',
    })

    // Keep original blobs separate from augmented so accuracy can be
    // measured honestly on unmodified images after training.
    const origBlobs: Blob[] = []
    const origLabels: number[] = []
    const augBlobs: Blob[] = []
    const augLabels: number[] = []

    for (let i = 0; i < classIds.length; i++) {
      const samples = await getSamplesByClass(classIds[i])
      for (const s of samples) {
        origBlobs.push(s.blob)
        origLabels.push(i)
        try {
          const variants = await getAugmentedBlobs(s.blob)
          for (const v of variants) {
            augBlobs.push(v)
            augLabels.push(i)
          }
        } catch {
          // augmentation failed for this sample — skip quietly
        }
      }
    }

    if (origBlobs.length === 0) {
      self.postMessage({ type: 'ERROR', error: 'No hay muestras para entrenar' })
      return
    }

    const totalBlobs = origBlobs.length + augBlobs.length

    // ── 2. Load feature extractor ──────────────────────────────────────────
    const extractor = await loadFeatureExtractor((msg) => {
      postProgress({
        status: 'extracting_features',
        currentEpoch: 0,
        totalEpochs: config.epochs,
        metrics: [],
        message: msg,
      })
    })

    // ── 3. Extract features (original first, then augmented) ───────────────
    const origFeatures: Float32Array[] = []
    const augFeatures: Float32Array[] = []

    for (let i = 0; i < origBlobs.length; i++) {
      origFeatures.push(await extractFeatures(origBlobs[i], extractor))
      postProgress({
        status: 'extracting_features',
        currentEpoch: 0,
        totalEpochs: config.epochs,
        metrics: [],
        message: `Extrayendo features: ${i + 1}/${totalBlobs}`,
      })
    }

    for (let i = 0; i < augBlobs.length; i++) {
      augFeatures.push(await extractFeatures(augBlobs[i], extractor))
      postProgress({
        status: 'extracting_features',
        currentEpoch: 0,
        totalEpochs: config.epochs,
        metrics: [],
        message: `Extrayendo features (aug): ${origBlobs.length + i + 1}/${totalBlobs}`,
      })
    }

    const allFeatures = [...origFeatures, ...augFeatures]
    const allLabels = [...origLabels, ...augLabels]

    // ── 4. Train ───────────────────────────────────────────────────────────
    const model = buildClassifier(classIds.length, allFeatures[0].length)
    const metrics: TrainingProgress['metrics'] = []

    postProgress({
      status: 'training',
      currentEpoch: 0,
      totalEpochs: config.epochs,
      metrics: [],
      message: `Entrenando con ${allFeatures.length} muestras (${origBlobs.length} orig + ${augBlobs.length} aug)...`,
    })

    await trainClassifier(model, allFeatures, allLabels, classIds.length, config, (epochMetrics) => {
      metrics.push(epochMetrics)
      postProgress({
        status: 'training',
        currentEpoch: epochMetrics.epoch,
        totalEpochs: config.epochs,
        metrics: [...metrics],
        message: `Epoch ${epochMetrics.epoch}/${config.epochs} — loss: ${epochMetrics.loss.toFixed(4)} acc: ${(epochMetrics.accuracy * 100).toFixed(1)}%`,
      })
    })

    // ── 5. Evaluate per-class accuracy on ORIGINAL samples only ───────────
    postProgress({
      status: 'evaluating',
      currentEpoch: config.epochs,
      totalEpochs: config.epochs,
      metrics,
      message: 'Evaluando precisión por clase...',
    })

    const perClassAccuracy: PerClassResult[] = classIds.map((classId, classIdx) => {
      const indices = origLabels
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l === classIdx)
        .map(({ i }) => i)

      let correct = 0
      for (const idx of indices) {
        const input = tf.tensor2d([Array.from(origFeatures[idx])])
        const output = model.predict(input) as tf.Tensor
        const probs = Array.from(output.dataSync() as Float32Array)
        tf.dispose([input, output])
        const pred = probs.indexOf(Math.max(...probs))
        if (pred === classIdx) correct++
      }

      return { classId, correct, total: indices.length }
    })

    // ── 6. Serialize ───────────────────────────────────────────────────────
    postProgress({
      status: 'saving',
      currentEpoch: config.epochs,
      totalEpochs: config.epochs,
      metrics,
      message: 'Guardando modelo...',
      perClassAccuracy,
    })

    const artifacts = await serializeModel(model)
    const lastMetric = metrics[metrics.length - 1]

    const result: TrainingResult = {
      modelArtifacts: artifacts,
      classIds,
      finalAccuracy: lastMetric?.accuracy ?? 0,
      finalLoss: lastMetric?.loss ?? 0,
      trainedAt: Date.now(),
      perClassAccuracy,
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
