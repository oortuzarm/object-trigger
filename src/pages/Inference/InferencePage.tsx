import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useCamera } from '@/hooks/useCamera'
import { useInference } from '@/hooks/useInference'
import CameraView from '@/components/camera/CameraView'
import DetectionOverlay from '@/components/overlay/DetectionOverlay'
import InferenceControls from './InferenceControls'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function InferencePage() {
  const navigate = useNavigate()
  const { modelStatus, classes } = useAppStore()
  const camera = useCamera()
  const { inferenceState, start, stop } = useInference(camera.videoRef)

  useEffect(() => {
    camera.start()
    return () => {
      camera.stop()
      stop()
    }
  }, [])

  if (modelStatus !== 'ready') {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto text-center pt-16 sm:pt-20">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4 text-3xl">
          ⚡
        </div>
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Sin modelo entrenado</h2>
        <p className="text-sm text-gray-500 mb-6">
          Necesitas entrenar un modelo antes de poder reconocer objetos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate('/classes')} variant="secondary" className="w-full sm:w-auto">
            Crear clases
          </Button>
          <Button onClick={() => navigate('/training')} className="w-full sm:w-auto">
            Ir a entrenamiento
          </Button>
        </div>
      </div>
    )
  }

  const det = inferenceState.currentDetection
  const activeCls = det ? classes.find((c) => c.id === det.classId) : null

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-100">Reconocimiento en vivo</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {classes.length} clase{classes.length !== 1 ? 's' : ''} — apunta la cámara a un objeto
          </p>
        </div>
        <InferenceControls inferenceState={inferenceState} onStart={start} onStop={stop} />
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
        {/* Camera */}
        <div className="lg:col-span-2">
          <div className="relative">
            <CameraView
              ref={camera.videoRef}
              isActive={camera.state.isActive}
              error={camera.state.error}
              onFlip={camera.flip}
              className="w-full aspect-[4/3] sm:aspect-video"
            />
            {inferenceState.status === 'running' && <DetectionOverlay />}
          </div>

          {inferenceState.status !== 'running' && camera.state.isActive && (
            <div className="mt-3 p-3 rounded-xl border border-dashed border-gray-700 flex flex-col sm:flex-row items-center justify-center gap-3">
              <span className="text-sm text-gray-500 text-center">
                Cámara activa — presiona Iniciar para reconocer
              </span>
              <Button size="sm" onClick={start} className="w-full sm:w-auto">
                Iniciar reconocimiento
              </Button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-3">
          {/* Live detection */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Detección activa
            </h3>
            {det && activeCls ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: activeCls.color + '22', color: activeCls.color }}
                  >
                    {det.className[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-100 truncate">{det.className}</div>
                    <div className="text-xs text-gray-500">
                      Confianza: {Math.round(det.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.round(det.confidence * 100)}%`,
                      backgroundColor: activeCls.color,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-600">
                <div className="text-2xl mb-1">◎</div>
                <p className="text-xs">
                  {inferenceState.status === 'running' ? 'Buscando objetos...' : 'Inactivo'}
                </p>
              </div>
            )}
          </Card>

          {/* Classes list — collapsible on mobile */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Clases del modelo
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-1">
              {classes.map((cls) => {
                const isActive = inferenceState.currentDetection?.classId === cls.id
                return (
                  <div
                    key={cls.id}
                    className={[
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
                      isActive ? 'bg-white/5' : '',
                    ].join(' ')}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isActive ? cls.color : cls.color + '55' }}
                    />
                    <span
                      className={[
                        'text-sm truncate',
                        isActive ? 'text-gray-100 font-medium' : 'text-gray-500',
                      ].join(' ')}
                    >
                      {cls.name}
                    </span>
                    {isActive && (
                      <span className="ml-auto text-xs font-mono flex-shrink-0" style={{ color: cls.color }}>
                        {Math.round((inferenceState.currentDetection?.confidence ?? 0) * 100)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/configure')}
            className="w-full"
          >
            Configurar overlays y assets →
          </Button>
        </div>
      </div>
    </div>
  )
}
