import { useState, useCallback, useRef, useEffect } from 'react'
import { useCamera } from './useCamera'
import { analyzeQuality } from '@/features/quality/qualityAnalyzer'
import { saveSample, getSamplesByClass, deleteSample } from '@/features/storage/samplesStore'
import { updateSampleCount } from '@/features/storage/classesStore'
import { useAppStore } from '@/store/appStore'
import type { TrainingSample, QualityReport } from '@/types/sample.types'
import { toast } from '@/components/ui/Toast'
import { generateId } from '@/utils/generateId'
// --- Object segmentation preprocessing ---
import {
  preloadDetector,
  isDetectorReady,
  detectAndCrop,
} from '@/features/segmentation/objectCropper'
import type { CropInfo } from '@/features/segmentation/objectCropper'

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
  // --- Segmentation state ---
  const [detectorReady, setDetectorReady] = useState(isDetectorReady())
  const [lastCropInfo, setLastCropInfo] = useState<CropInfo | null>(null)
  const lastImageData = useRef<ImageData | undefined>(undefined)

  // Eagerly load COCO-SSD model when capture session starts.
  // This runs once and populates the singleton so subsequent captures are fast.
  useEffect(() => {
    if (isDetectorReady()) return
    preloadDetector()
      .then(() => setDetectorReady(true))
      .catch(() => {
        // Detection will gracefully fall back to saliency/center crop
        setDetectorReady(true)
      })
  }, [])

  const loadSamples = useCallback(async () => {
    const loaded = await getSamplesByClass(classId)
    setSamples(loaded)
  }, [classId])

  const captureOne = useCallback(async () => {
    if (!camera.state.isActive || capturing) return
    setCapturing(true)

    try {
      // 1. Grab raw frame from camera (224×224 square crop of video)
      const rawImageData = camera.captureFrame(224)
      if (!rawImageData) return

      // --- Object segmentation preprocessing ---
      // detectAndCrop() isolates the main object from the raw frame:
      //   - COCO-SSD detection → tight bounding-box crop (if confidence ≥ 0.4)
      //   - Saliency fallback  → gradient-weighted centroid crop
      //   - Center 65% crop   → last resort when nothing is detected
      // The resulting blob replaces the raw blob so the training worker learns
      // the object rather than the full scene context.
      const cropResult = await detectAndCrop(rawImageData)
      setLastCropInfo(cropResult.cropInfo)

      // Warn the user when detection confidence is very low
      if (cropResult.cropInfo.confidence < 0.2) {
        toast.warning('Objeto no detectado claramente — intenta con fondo más simple')
      }

      // 2. Quality analysis runs on the CROPPED image, not the raw frame.
      //    This ensures blur/brightness/diversity checks apply to the object itself.
      const quality = analyzeQuality(cropResult.imageData, lastImageData.current)
      setLastQuality(quality)
      // Track cropped images for diversity comparison between samples
      lastImageData.current = cropResult.imageData

      const sample: TrainingSample = {
        id: generateId(),
        classId,
        blob: cropResult.blob,        // cropped object, used for training
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
    detectorReady,
    lastCropInfo,
    loadSamples,
    captureOne,
    removeSample,
  }
}
