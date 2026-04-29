import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { inferenceEngine } from '@/features/inference/inferenceEngine'
import type { FrameResult } from '@/features/inference/inferenceEngine'
import { matchKeywords } from '@/features/ocr/ocrMatcher'
import { loadModel } from '@/features/storage/modelsStore'
import { toast } from '@/components/ui/Toast'

export function useInference(videoRef: React.RefObject<HTMLVideoElement>) {
  const { classes, setInferenceState, inferenceState } = useAppStore()
  const loadedRef = useRef(false)

  const handleFrame = useCallback(
    (frame: FrameResult) => {
      const { stable, bestGuess, detection, cropThumbnail, cropMethod, requiredStreak, mode, ocrText } = frame

      // No COCO-SSD detection → classifier/embeddings did not run
      if (!bestGuess || !detection) {
        setInferenceState({ currentDetection: null, debugPrediction: null })
        return
      }

      // ── OCR signal ────────────────────────────────────────────────────────
      const ocrMatch = ocrText ? matchKeywords(ocrText, classes) : null
      const ocrMatchClassId = ocrMatch?.classId ?? null
      const ocrMatchedKeyword = ocrMatch?.matchedKeyword ?? null

      const bestCls = classes.find((c) => c.id === bestGuess.classId)
      const debugPrediction = bestCls
        ? {
            classId: bestGuess.classId,
            className: bestCls.name,
            confidence: bestGuess.confidence,
            allProbabilities: bestGuess.allProbs,
            streakFrames: bestGuess.streak,
            requiredFrames: requiredStreak,
            detectionScore: detection.score,
            detectionLabel: detection.label,
            detectionBbox: detection.bbox,
            cropThumbnail,
            ocrText: ocrText ?? null,
            ocrMatchClassId,
            ocrMatchedKeyword,
          }
        : null

      let currentDetection = null

      if (stable) {
        const cls = classes.find((c) => c.id === stable.classId)
        if (cls) {
          const base = cls.confidenceThreshold
          // OCR boost: when OCR confirms the same class as embedding winner,
          // lower the required threshold by 20% (but never below 0.40).
          const effective = stable.classId === ocrMatchClassId
            ? Math.max(0.40, base * 0.80)
            : base
          if (stable.avgConfidence >= effective) {
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
              detectionScore: detection.score,
              detectionLabel: detection.label,
              detectionBbox: detection.bbox,
            }
          }
        }
      }

      setInferenceState({ currentDetection, debugPrediction, mode })
    },
    [classes, setInferenceState]
  )

  const loadEngineIfNeeded = useCallback(async () => {
    if (loadedRef.current) return true

    const currentClassIds = classes.map((c) => c.id)
    if (currentClassIds.length === 0) {
      toast.error('No hay clases definidas.')
      setInferenceState({ status: 'no_model' })
      return false
    }

    // ── Embeddings mode (preferred) ─────────────────────────────────────────
    const hasEmbeddings = await inferenceEngine.tryLoadEmbeddings(currentClassIds)
    if (hasEmbeddings) {
      console.log('[Inference] Modo embeddings — %d vectores cargados', currentClassIds.length)
      loadedRef.current = true
      setInferenceState({ mode: 'embeddings' })
      return true
    }

    // ── Classifier fallback ─────────────────────────────────────────────────
    const stored = await loadModel()
    if (!stored) {
      toast.error('No hay embeddings ni modelo entrenado. Captura imágenes primero.')
      setInferenceState({ status: 'no_model' })
      return false
    }

    console.log('[Inference] Modo clasificador — clases:', stored.classIds)
    await inferenceEngine.load(stored.artifacts, stored.classIds)
    loadedRef.current = true
    setInferenceState({ mode: 'classifier' })
    return true
  }, [classes, setInferenceState])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    const ready = await loadEngineIfNeeded()
    if (!ready) return

    setInferenceState({
      status: 'running',
      error: undefined,
      currentDetection: null,
      debugPrediction: null,
    })
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
