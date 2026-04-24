import { useState, useCallback, useRef } from 'react'
import { useCamera } from './useCamera'
import { analyzeQuality } from '@/features/quality/qualityAnalyzer'
import { saveSample, getSamplesByClass, deleteSample } from '@/features/storage/samplesStore'
import { updateSampleCount } from '@/features/storage/classesStore'
import { useAppStore } from '@/store/appStore'
import type { TrainingSample, QualityReport } from '@/types/sample.types'
import { toast } from '@/components/ui/Toast'

const CAPTURE_HINTS = [
  'Varía el ángulo: fotografía desde arriba o abajo',
  'Cambia la distancia al objeto',
  'Prueba con diferente fondo',
  'Varía la iluminación',
  'Rota el objeto ligeramente',
  'Mueve la cámara a la izquierda',
  'Mueve la cámara a la derecha',
  'Acércate más al objeto',
  'Aleja la cámara del objeto',
]

export function useCapture(classId: string) {
  const camera = useCamera()
  const { upsertClass, classes } = useAppStore()
  const cls = classes.find((c) => c.id === classId)

  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [lastQuality, setLastQuality] = useState<QualityReport | null>(null)
  const [hintIndex, setHintIndex] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const lastImageData = useRef<ImageData | undefined>(undefined)

  const loadSamples = useCallback(async () => {
    const loaded = await getSamplesByClass(classId)
    setSamples(loaded)
  }, [classId])

  const captureOne = useCallback(async () => {
    if (!camera.state.isActive || capturing) return
    setCapturing(true)

    try {
      const imageData = camera.captureFrame(224)
      const blob = await camera.captureBlob(224)
      if (!imageData || !blob) return

      const quality = analyzeQuality(imageData, lastImageData.current)
      setLastQuality(quality)
      lastImageData.current = imageData

      // Generate thumbnail
      const canvas = document.createElement('canvas')
      canvas.width = 112
      canvas.height = 112
      const ctx = canvas.getContext('2d')!
      ctx.putImageData(imageData, 0, 0)
      // Scale down
      const thumb = document.createElement('canvas')
      thumb.width = 112
      thumb.height = 112
      const tctx = thumb.getContext('2d')!
      tctx.drawImage(canvas, 0, 0, 224, 224, 0, 0, 112, 112)
      const thumbnail = thumb.toDataURL('image/jpeg', 0.7)

      const sample: TrainingSample = {
        id: crypto.randomUUID(),
        classId,
        blob,
        capturedAt: Date.now(),
        qualityReport: quality,
        thumbnail,
      }

      await saveSample(sample)
      setSamples((prev) => [...prev, sample])

      // Update class sample count
      const newCount = samples.length + 1
      await updateSampleCount(classId, newCount)
      if (cls) upsertClass({ ...cls, sampleCount: newCount })

      // Rotate hint every 5 captures
      if (newCount % 5 === 0) {
        setHintIndex((i) => (i + 1) % CAPTURE_HINTS.length)
      }

      if (quality.flags.includes('blur')) toast.warning('Imagen borrosa — mantén la cámara quieta')
      if (quality.flags.includes('dark')) toast.warning('Poca iluminación detectada')
    } finally {
      setCapturing(false)
    }
  }, [camera, capturing, classId, samples.length, cls, upsertClass])

  const removeSample = useCallback(
    async (id: string) => {
      await deleteSample(id)
      setSamples((prev) => prev.filter((s) => s.id !== id))
      const newCount = samples.length - 1
      await updateSampleCount(classId, newCount)
      if (cls) upsertClass({ ...cls, sampleCount: newCount })
    },
    [classId, samples.length, cls, upsertClass]
  )

  const currentHint = CAPTURE_HINTS[hintIndex]

  return {
    camera,
    samples,
    lastQuality,
    currentHint,
    capturing,
    loadSamples,
    captureOne,
    removeSample,
  }
}
