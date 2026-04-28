import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { inferenceEngine } from '@/features/inference/inferenceEngine'
import type { FrameResult } from '@/features/inference/inferenceEngine'
import { loadModel } from '@/features/storage/modelsStore'
import { toast } from '@/components/ui/Toast'

export function useInference(videoRef: React.RefObject<HTMLVideoElement>) {
  const { classes, modelClassIds, setInferenceState, inferenceState } = useAppStore()
  const loadedRef = useRef(false)

  /**
   * Handles every inference frame result.
   *
   * Two separate updates per frame:
   *   debugPrediction — always updated with the best-guess class (for debug panel)
   *   currentDetection — only set when the streak is stable AND confidence
   *                      exceeds the per-class threshold; otherwise null.
   *
   * This ensures "Detección activa" never shows a class name prematurely.
   */
  const handleFrame = useCallback(
    (frame: FrameResult) => {
      const { stable, bestGuess, cropMethod, requiredStreak } = frame

      // ── Debug prediction (always shown in the probabilities panel) ──────
      const bestCls = classes.find((c) => c.id === bestGuess.classId)
      const debugPrediction = bestCls
        ? {
            classId: bestGuess.classId,
            className: bestCls.name,
            confidence: bestGuess.confidence,
            allProbabilities: bestGuess.allProbs,
            streakFrames: bestGuess.streak,
            requiredFrames: requiredStreak,
          }
        : null

      // ── Confirmed detection (only when stable + above per-class threshold) ─
      let currentDetection = null

      if (stable) {
        const cls = classes.find((c) => c.id === stable.classId)
        if (cls && stable.avgConfidence >= cls.confidenceThreshold) {
          currentDetection = {
            classId: cls.id,
            className: cls.name,
            confidence: stable.avgConfidence,
            timestamp: Date.now(),
            isAboveThreshold: true,
            allProbabilities: bestGuess.allProbs,
            cropMethod,
            streakFrames: stable.streak,
            requiredFrames: requiredStreak,
          }
        }
      }

      setInferenceState({ currentDetection, debugPrediction })
    },
    [classes, setInferenceState]
  )

  const loadEngineIfNeeded = useCallback(async () => {
    if (loadedRef.current) return true

    const stored = await loadModel()
    if (!stored) {
      toast.error('No hay modelo entrenado. Entrena primero.')
      setInferenceState({ status: 'no_model' })
      return false
    }

    console.log('[Inference] Cargando modelo — clases:', stored.classIds)
    await inferenceEngine.load(stored.artifacts, stored.classIds)
    console.log('[Inference] Modelo listo, clases actuales en store:', modelClassIds)
    loadedRef.current = true
    return true
  }, [setInferenceState, modelClassIds])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    const ready = await loadEngineIfNeeded()
    if (!ready) return

    setInferenceState({ status: 'running', error: undefined, currentDetection: null, debugPrediction: null })
    inferenceEngine.start(
      video,
      handleFrame,
      (fps) => setInferenceState({ fps }),
      (errMsg) => setInferenceState({ error: errMsg })
    )
  }, [videoRef, loadEngineIfNeeded, handleFrame, setInferenceState])

  const stop = useCallback(() => {
    inferenceEngine.stop()
    setInferenceState({ status: 'idle', currentDetection: null, debugPrediction: null, fps: 0 })
  }, [setInferenceState])

  useEffect(() => {
    return () => {
      inferenceEngine.stop()
      setInferenceState({ status: 'idle', currentDetection: null, debugPrediction: null, fps: 0 })
    }
  }, [])

  return { inferenceState, start, stop }
}
