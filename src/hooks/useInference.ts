import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { inferenceEngine } from '@/features/inference/inferenceEngine'
import { loadModel } from '@/features/storage/modelsStore'
import type { DetectionResult } from '@/types/inference.types'
import { toast } from '@/components/ui/Toast'

export function useInference(videoRef: React.RefObject<HTMLVideoElement>) {
  const { classes, modelClassIds, setInferenceState, inferenceState } = useAppStore()
  const loadedRef = useRef(false)

  // Enrich detection with class name + threshold check.
  // IMPORTANT: we always forward the detection even when it's below threshold.
  // isAboveThreshold=false lets the UI show it dimmed instead of hiding it,
  // which is essential for debugging model performance.
  const handleDetection = useCallback(
    (raw: DetectionResult | null) => {
      if (!raw) {
        setInferenceState({ currentDetection: null })
        return
      }

      const cls = classes.find((c) => c.id === raw.classId)
      if (!cls) {
        // classId from stored model doesn't match any current class
        console.warn('[Inference] Unknown classId:', raw.classId, '— loaded classIds:', modelClassIds)
        setInferenceState({ currentDetection: null })
        return
      }

      const isAbove = raw.confidence >= cls.confidenceThreshold

      // Always set the detection — UI uses isAboveThreshold to decide display style
      setInferenceState({
        currentDetection: {
          ...raw,
          className: cls.name,
          isAboveThreshold: isAbove,
        },
      })
    },
    [classes, modelClassIds, setInferenceState]
  )

  const loadEngineIfNeeded = useCallback(async () => {
    if (loadedRef.current) return true

    const stored = await loadModel()
    if (!stored) {
      toast.error('No hay modelo entrenado. Entrena primero.')
      setInferenceState({ status: 'no_model' })
      return false
    }

    console.log('[Inference] Cargando modelo — clases entrenadas:', stored.classIds)
    await inferenceEngine.load(stored.artifacts, stored.classIds)
    console.log('[Inference] Modelo listo')
    loadedRef.current = true
    return true
  }, [setInferenceState])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    const ready = await loadEngineIfNeeded()
    if (!ready) return

    setInferenceState({ status: 'running', error: undefined })
    inferenceEngine.start(
      video,
      handleDetection,
      (fps) => setInferenceState({ fps }),
      (errMsg) => setInferenceState({ error: errMsg })
    )
  }, [videoRef, loadEngineIfNeeded, handleDetection, setInferenceState])

  const stop = useCallback(() => {
    inferenceEngine.stop()
    setInferenceState({ status: 'idle', currentDetection: null, fps: 0 })
  }, [setInferenceState])

  useEffect(() => {
    return () => {
      inferenceEngine.stop()
      setInferenceState({ status: 'idle', currentDetection: null, fps: 0 })
    }
  }, [])

  return { inferenceState, start, stop }
}
