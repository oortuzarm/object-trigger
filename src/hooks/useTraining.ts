import { useCallback, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { saveModel } from '@/features/storage/modelsStore'
import type { TrainingConfig } from '@/types/training.types'
import { toast } from '@/components/ui/Toast'

export function useTraining() {
  const { classes, trainingProgress, setTrainingProgress, setModelReady } = useAppStore()
  const workerRef = useRef<Worker | null>(null)

  const startTraining = useCallback(
    async (config: TrainingConfig) => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }

      const classIds = classes.map((c) => c.id)
      if (classIds.length < 2) {
        toast.error('Se necesitan al menos 2 clases para entrenar')
        return
      }

      const worker = new Worker(
        new URL('../workers/training.worker.ts', import.meta.url),
        { type: 'module' }
      )
      workerRef.current = worker

      worker.onmessage = async (e) => {
        const msg = e.data

        if (msg.type === 'PROGRESS') {
          setTrainingProgress(msg.progress)
        }

        if (msg.type === 'DONE') {
          const result = msg.result
          // Save model to IDB
          await saveModel({
            artifacts: result.modelArtifacts,
            classIds: result.classIds,
            trainedAt: result.trainedAt,
          })
          setModelReady(result.classIds)
          setTrainingProgress({
            ...msg.result,
            status: 'done',
            currentEpoch: config.epochs,
            totalEpochs: config.epochs,
            metrics: trainingProgress?.metrics ?? [],
            message: `Entrenamiento completo — Precisión: ${(result.finalAccuracy * 100).toFixed(1)}%`,
          })
          toast.success(`Modelo entrenado — ${(result.finalAccuracy * 100).toFixed(1)}% de precisión`)
          worker.terminate()
          workerRef.current = null
        }

        if (msg.type === 'ERROR') {
          setTrainingProgress({
            status: 'error',
            currentEpoch: 0,
            totalEpochs: config.epochs,
            metrics: [],
            message: msg.error,
            error: msg.error,
          })
          toast.error(`Error: ${msg.error}`)
          worker.terminate()
          workerRef.current = null
        }
      }

      worker.postMessage({ type: 'START', classIds, config })
    },
    [classes, setTrainingProgress, setModelReady, trainingProgress]
  )

  const cancelTraining = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setTrainingProgress(null)
  }, [setTrainingProgress])

  return { trainingProgress, startTraining, cancelTraining }
}
