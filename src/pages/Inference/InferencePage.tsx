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
  const { modelStatus, classes, modelClassIds } = useAppStore()
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
  const isRunning = inferenceState.status === 'running'

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-100">Reconocimiento en vivo</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {classes.length} clase{classes.length !== 1 ? 's' : ''} — apunta la cámara a un objeto
          </p>
        </div>
        <InferenceControls inferenceState={inferenceState} onStart={start} onStop={stop} />
      </div>

      {/* Engine error banner */}
      {inferenceState.error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-950/40 border border-red-800/30">
          <span className="text-red-400 flex-shrink-0 mt-px text-sm">✕</span>
          <p className="text-xs text-red-400 font-mono break-all">{inferenceState.error}</p>
        </div>
      )}

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
            {isRunning && <DetectionOverlay />}
          </div>

          {!isRunning && camera.state.isActive && (
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
                {/* Winner */}
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0',
                      det.isAboveThreshold ? 'opacity-100' : 'opacity-40',
                    ].join(' ')}
                    style={{ backgroundColor: activeCls.color + '22', color: activeCls.color }}
                  >
                    {det.className[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={['font-semibold truncate', det.isAboveThreshold ? 'text-gray-100' : 'text-gray-500'].join(' ')}>
                      {det.isAboveThreshold ? det.className : `Posible: ${det.className}`}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{Math.round(det.confidence * 100)}% confianza</span>
                      {!det.isAboveThreshold && (
                        <span className="text-yellow-600">
                          (umbral: {Math.round((activeCls.confidenceThreshold ?? 0.7) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confidence bar for winning class */}
                <div className="space-y-0.5">
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${Math.round(det.confidence * 100)}%`,
                        backgroundColor: det.isAboveThreshold ? activeCls.color : activeCls.color + '55',
                      }}
                    />
                  </div>
                  {/* Threshold marker */}
                  <div className="relative h-1">
                    <div
                      className="absolute top-0 w-px h-2 bg-yellow-600/60"
                      style={{ left: `${Math.round(activeCls.confidenceThreshold * 100)}%` }}
                      title="Umbral de confianza"
                    />
                  </div>
                </div>

                {/* Crop method badge */}
                {det.cropMethod && (
                  <div className="text-[10px] text-gray-600">
                    Recorte: {det.cropMethod === 'cocoSsd' ? 'objeto detectado' : det.cropMethod === 'saliency' ? 'saliencia' : 'central'}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-600">
                <div className="text-2xl mb-1">◎</div>
                <p className="text-xs">
                  {isRunning ? 'Buscando objetos…' : 'Inactivo'}
                </p>
              </div>
            )}
          </Card>

          {/* All-class probabilities panel — always visible when running */}
          {isRunning && (
            <Card>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Clases del modelo
              </h3>
              <div className="space-y-2">
                {modelClassIds.map((classId, idx) => {
                  const cls = classes.find((c) => c.id === classId)
                  if (!cls) return null
                  const prob = det?.allProbabilities?.[idx] ?? null
                  const isWinner = det?.classId === classId
                  const isAbove = isWinner && det?.isAboveThreshold

                  return (
                    <div key={classId} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: isWinner ? cls.color : cls.color + '55' }}
                          />
                          <span className={['text-xs truncate', isWinner ? 'text-gray-200 font-medium' : 'text-gray-500'].join(' ')}>
                            {cls.name}
                          </span>
                        </div>
                        <span className={['text-xs font-mono flex-shrink-0', isAbove ? 'text-green-400' : isWinner ? 'text-yellow-500' : 'text-gray-600'].join(' ')}>
                          {prob !== null ? `${Math.round(prob * 100)}%` : '—'}
                        </span>
                      </div>
                      {prob !== null && (
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.round(prob * 100)}%`,
                              backgroundColor: isAbove ? cls.color : isWinner ? cls.color + '88' : cls.color + '33',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* FPS indicator */}
                {inferenceState.fps > 0 && (
                  <p className="text-[10px] text-gray-700 pt-1 text-right font-mono">
                    {inferenceState.fps} fps
                  </p>
                )}
              </div>
            </Card>
          )}

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
