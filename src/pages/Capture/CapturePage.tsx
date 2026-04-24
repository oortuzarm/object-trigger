import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useCapture } from '@/hooks/useCapture'
import CameraView from '@/components/camera/CameraView'
import CaptureGuide from '@/components/camera/CaptureGuide'
import CaptureGrid from './CaptureGrid'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export default function CapturePage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const { classes } = useAppStore()
  const cls = classes.find((c) => c.id === classId)

  const { camera, samples, lastQuality, currentHint, capturing, loadSamples, captureOne, removeSample } =
    useCapture(classId ?? '')

  useEffect(() => {
    if (!classId) return
    loadSamples()
    camera.start()
    return () => camera.stop()
  }, [classId])

  if (!cls) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500 mb-4">Clase no encontrada</p>
        <Button onClick={() => navigate('/classes')} variant="secondary">
          Volver a clases
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          to="/classes"
          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
            <span className="truncate">{cls.name}</span>
          </h1>
          <p className="text-xs text-gray-500">Captura muestras de entrenamiento</p>
        </div>
      </div>

      {/* Mobile: stacked — Camera first, then guide below */}
      {/* Desktop: Camera (2/3) + Guide (1/3) side by side */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
        {/* Camera column */}
        <div className="lg:col-span-2 space-y-3">
          <CameraView
            ref={camera.videoRef}
            isActive={camera.state.isActive}
            error={camera.state.error}
            onFlip={camera.flip}
            className="w-full aspect-[4/3] sm:aspect-video"
          />

          {/* Capture button — large tap target on mobile */}
          <button
            onClick={captureOne}
            disabled={!camera.state.isActive || capturing}
            className="w-full py-4 sm:py-4 rounded-2xl bg-gray-900 border-2 border-dashed border-gray-700 hover:border-brand-600/60 hover:bg-brand-950/10 active:bg-brand-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-3"
          >
            {capturing ? (
              <>
                <Spinner size="sm" />
                <span className="text-sm font-medium text-gray-400">Capturando...</span>
              </>
            ) : (
              <>
                <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full border-2 border-brand-500 bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 sm:w-3 sm:h-3 rounded-full bg-brand-500" />
                </div>
                <span className="text-sm font-medium text-gray-300">Capturar muestra</span>
                <span className="text-xs text-gray-600 ml-auto mr-2 hidden sm:block">Espacio</span>
              </>
            )}
          </button>
        </div>

        {/* Guide sidebar */}
        <div className="space-y-3">
          <CaptureGuide sampleCount={samples.length} currentHint={currentHint} lastQuality={lastQuality} />
        </div>
      </div>

      {/* Samples grid */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">
            Muestras capturadas ({samples.length})
          </h2>
          {samples.length >= 20 && (
            <Button onClick={() => navigate('/dataset')} variant="outline" size="sm">
              Ver dataset →
            </Button>
          )}
        </div>
        <CaptureGrid samples={samples} onDelete={removeSample} />
      </div>
    </div>
  )
}
