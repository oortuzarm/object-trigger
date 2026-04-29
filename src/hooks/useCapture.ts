import { useState, useCallback, useRef, useEffect } from 'react'
import { useCamera } from './useCamera'
import { analyzeQuality } from '@/features/quality/qualityAnalyzer'
import { saveSample, getSamplesByClass, deleteSample } from '@/features/storage/samplesStore'
import { updateSampleCount } from '@/features/storage/classesStore'
import { useAppStore } from '@/store/appStore'
import type { TrainingSample, QualityReport } from '@/types/sample.types'
import { toast } from '@/components/ui/Toast'
import { generateId } from '@/utils/generateId'
import {
  preloadDetector,
  isDetectorReady,
  detectAndCrop,
} from '@/features/segmentation/objectCropper'
import type { CropInfo } from '@/features/segmentation/objectCropper'
import { loadFeatureExtractor } from '@/features/training/featureExtractor'
import { generateEmbedding } from '@/features/embeddings/embeddingEngine'
import { saveEmbedding, deleteEmbedding } from '@/features/embeddings/embeddingStore'

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
  const { upsertClass, classes, setEmbeddingCounts } = useAppStore()
  const cls = classes.find((c) => c.id === classId)

  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [lastQuality, setLastQuality] = useState<QualityReport | null>(null)
  const [hintIndex, setHintIndex] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [detectorReady, setDetectorReady] = useState(isDetectorReady())
  const [lastCropInfo, setLastCropInfo] = useState<CropInfo | null>(null)
  const lastImageData = useRef<ImageData | undefined>(undefined)

  // Preload COCO-SSD and MobileNet together so the first capture is fast.
  useEffect(() => {
    Promise.all([
      isDetectorReady() ? Promise.resolve() : preloadDetector(),
      loadFeatureExtractor(),  // warms up the shared MobileNet singleton
    ])
      .then(() => setDetectorReady(true))
      .catch(() => setDetectorReady(true))
  }, [])

  const loadSamples = useCallback(async () => {
    const loaded = await getSamplesByClass(classId)
    setSamples(loaded)
  }, [classId])

  const captureOne = useCallback(async () => {
    if (!camera.state.isActive || capturing) return
    setCapturing(true)

    try {
      // 1. Raw frame from camera
      const rawImageData = camera.captureFrame(224)
      if (!rawImageData) return

      // 2. COCO-SSD crop
      const cropResult = await detectAndCrop(rawImageData)
      setLastCropInfo(cropResult.cropInfo)

      if (cropResult.cropInfo.confidence < 0.2) {
        toast.warning('Objeto no detectado claramente — intenta con fondo más simple')
      }

      // 3. Quality analysis on cropped image
      const quality = analyzeQuality(cropResult.imageData, lastImageData.current)
      setLastQuality(quality)
      lastImageData.current = cropResult.imageData

      const sampleId = generateId()

      const sample: TrainingSample = {
        id: sampleId,
        classId,
        blob: cropResult.blob,
        capturedAt: Date.now(),
        qualityReport: quality,
        cropInfo: cropResult.cropInfo,
        thumbnail: cropResult.thumbnail,
      }

      await saveSample(sample)
      setSamples((prev) => [...prev, sample])

      const newCount = samples.length + 1
      await updateSampleCount(classId, newCount)
      if (cls) upsertClass({ ...cls, sampleCount: newCount })

      // 4. Generate and persist embedding from the same crop canvas.
      //    Runs after sample is saved so a crop failure won't block the save.
      try {
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = 224
        cropCanvas.height = 224
        cropCanvas.getContext('2d')!.putImageData(cropResult.imageData, 0, 0)
        const vector = await generateEmbedding(cropCanvas)
        await saveEmbedding({
          id: sampleId,
          classId,
          vector: Array.from(vector),
          capturedAt: Date.now(),
        })
        // Refresh embedding counts in store so UI reflects immediately
        setEmbeddingCounts({ [classId]: newCount })
      } catch {
        // Embedding generation is best-effort — don't fail the capture
      }

      if (newCount % 5 === 0) {
        setHintIndex((i) => (i + 1) % CAPTURE_HINTS.length)
      }

      if (quality.flags.includes('blur')) toast.warning('Imagen borrosa — mantén la cámara quieta')
      if (quality.flags.includes('dark')) toast.warning('Poca iluminación detectada')
    } finally {
      setCapturing(false)
    }
  }, [camera, capturing, classId, samples.length, cls, upsertClass, setEmbeddingCounts])

  const removeSample = useCallback(
    async (id: string) => {
      await deleteSample(id)
      await deleteEmbedding(id)  // also remove the corresponding embedding
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
    detectorReady,
    lastCropInfo,
    loadSamples,
    captureOne,
    removeSample,
  }
}
