import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { inferenceEngine } from '@/features/inference/inferenceEngine'
import { loadModel } from '@/features/storage/modelsStore'
import type { DetectionResult } from '@/types/inference.types'
import { toast } from '@/components/ui/Toast'

export function useInference(videoRef: React.RefObject<HTMLVideoElement>) {
  const { classes, setInferenceState, inferenceState } = useAppStore()
  const loadedRef = useRef(false)

  // Enrich detection with class name + threshold check
  const handleDetection = useCallback(
    (raw: DetectionResult | null) => {
      if (!raw) {
        setInferenceState({ currentDetection: null })
        return
      }
      const cls = classes.find((c) => c.id === raw.classId)
      if (!cls) return

      const isAbove = raw.confidence >= cls.confidenceThreshold
      setInferenceState({
        currentDetection: isAbove
          ? { ...raw, className: cls.name, isAboveThreshold: true }
          : null,
      })
    },
    [classes, setInferenceState]
  )

  const loadEngineIfNeeded = useCallback(async () => {
    if (loadedRef.current) return true
    const stored = await loadModel()
    if (!stored) {
      toast.error('No hay modelo entrenado. Entrena primero.')
      return false
    }
    setInferenceState({ status: 'running', error: undefined })
    await inferenceEngine.load(stored.artifacts, stored.classIds)
    loadedRef.current = true
    return true
  }, [setInferenceState])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    const ready = await loadEngineIfNeeded()
    if (!ready) return

    setInferenceState({ status: 'running' })
    inferenceEngine.start(
      video,
      handleDetection,
      (fps) => setInferenceState({ fps })
    )
  }, [videoRef, loadEngineIfNeeded, handleDetection, setInferenceState])

  const stop = useCallback(() => {
    inferenceEngine.stop()
    setInferenceState({ status: 'idle', currentDetection: null, fps: 0 })
  }, [setInferenceState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      inferenceEngine.stop()
      setInferenceState({ status: 'idle', currentDetection: null, fps: 0 })
    }
  }, [])

  return { inferenceState, start, stop }
}
