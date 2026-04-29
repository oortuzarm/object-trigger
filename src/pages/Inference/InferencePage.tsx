import { useEffect, useState } from 'react'
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
  const [showDebug, setShowDebug] = useState(false)

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
  const debug = inferenceState.debugPrediction
  const activeCls = det ? classes.find((c) => c.id === det.classId) : null
  const isRunning = inferenceState.status === 'running'

  // ── Derived values for classifier panel ──────────────────────────────────
  const sortedProbs = debug?.allProbabilities
    ? modelClassIds
        .map((id, idx) => ({ id, prob: debug.allProbabilities![idx] ?? 0 }))
        .sort((a, b) => b.prob - a.prob)
    : []

  const top1 = sortedProbs[0]
  const top2 = sortedProbs[1]
  const isAmbiguous =
    !!top1 && !!top2 && !det && (top1.prob - top2.prob) < 0.10 && top1.prob > 0.3

  const top1Cls = top1 ? classes.find((c) => c.id === top1.id) : null
  const top2Cls = top2 ? classes.find((c) => c.id === top2.id) : null

  const debugCls = debug ? classes.find((c) => c.id === debug.classId) : null
  const classifierAboveThreshold = debug && debugCls
    ? debug.confidence >= (debugCls.confidenceThreshold ?? 0.75)
    : false

  const streakPct = debug ? Math.min(100, (debug.streakFrames / debug.requiredFrames) * 100) : 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-100">Reconocimiento en vivo</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {modelClassIds.length} clase{modelClassIds.length !== 1 ? 's' : ''} entrenadas
          </p>
        </div>
        <InferenceControls inferenceState={inferenceState} onStart={start} onStop={stop} />
      </div>

      {inferenceState.error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-950/40 border border-red-800/30">
          <span className="text-red-400 flex-shrink-0 mt-px">✕</span>
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
                Cámara lista — presiona Iniciar para reconocer
              </span>
              <Button size="sm" onClick={start} className="w-full sm:w-auto">
                Iniciar reconocimiento
              </Button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-3">

          {/* ── RESULTADO PRINCIPAL ──────────────────────────────────── */}
          <Card>

            {/* ✅ Clase confirmada */}
            {det && activeCls ? (
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: activeCls.color + '22', color: activeCls.color }}
                  >
                    {det.className[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold text-green-500 uppercase tracking-wider mb-0.5">
                      Objeto reconocido
                    </div>
                    <div className="font-bold text-gray-100 text-base truncate">{det.className}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {Math.round(det.confidence * 100)}% confianza
                    </div>
                  </div>
                  <span className="text-green-400 text-2xl flex-shrink-0 mt-0.5">✓</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.round(det.confidence * 100)}%`, backgroundColor: activeCls.color }}
                  />
                </div>
              </div>

            ) : isRunning && debug ? (
              /* 🟡 Objeto en cámara pero no reconocido */
              <div className="space-y-3">
                <div className="text-[10px] font-semibold text-yellow-500/80 uppercase tracking-wider">
                  Objeto detectado, no reconocido
                </div>

                {/* Ambiguity warning */}
                {isAmbiguous && top1Cls && top2Cls && (
                  <div className="px-2.5 py-2 rounded-lg bg-yellow-950/30 border border-yellow-800/30">
                    <p className="text-xs text-yellow-500">
                      Modelo no está seguro entre{' '}
                      <span className="font-medium">{top1Cls.name}</span>
                      {' '}y{' '}
                      <span className="font-medium">{top2Cls.name}</span>
                      {' '}({Math.round(top1.prob * 100)}% vs {Math.round(top2.prob * 100)}%).
                    </p>
                    <p className="text-[10px] text-yellow-700 mt-1">
                      Captura más muestras o reduce similitud entre clases.
                    </p>
                  </div>
                )}

                {/* Streak bar */}
                {classifierAboveThreshold && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>Estabilizando…</span>
                      <span>{debug.streakFrames}/{debug.requiredFrames} frames</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-150 bg-green-700"
                        style={{ width: `${streakPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

            ) : isRunning ? (
              /* ⚪ Sin detección */
              <div className="flex items-center gap-2 text-gray-600 py-1">
                <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="text-sm">Buscando objeto…</span>
              </div>

            ) : (
              /* Idle */
              <div className="text-center py-3 text-gray-700">
                <div className="text-2xl mb-1">◎</div>
                <p className="text-xs">Inactivo</p>
              </div>
            )}
          </Card>

          {/* ── CLASES ENTRENADAS — probabilidades en tiempo real ────── */}
          {isRunning && debug && (
            <Card>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Clases entrenadas
              </h3>
              <div className="space-y-2">
                {sortedProbs.map(({ id, prob }, rank) => {
                  const cls = classes.find((c) => c.id === id)
                  if (!cls) return null
                  const isWinner = debug.classId === id
                  const isConfirmed = det?.classId === id

                  return (
                    <div key={id} className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {rank === 0
                          ? <span className="text-[9px] text-yellow-600 w-2.5">▲</span>
                          : <span className="w-2.5" />
                        }
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isWinner ? cls.color : cls.color + '44' }}
                        />
                        <span className={[
                          'text-xs flex-1 truncate',
                          isConfirmed ? 'text-green-400 font-semibold'
                            : isWinner ? 'text-gray-200 font-medium'
                            : 'text-gray-500',
                        ].join(' ')}>
                          {cls.name}{isConfirmed && ' ✓'}
                        </span>
                        <span className={[
                          'text-xs font-mono flex-shrink-0',
                          isConfirmed ? 'text-green-400'
                            : isWinner ? 'text-yellow-400'
                            : 'text-gray-700',
                        ].join(' ')}>
                          {Math.round(prob * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5" />
                        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{
                              width: `${Math.round(prob * 100)}%`,
                              backgroundColor: isConfirmed ? cls.color
                                : isWinner ? cls.color + 'aa'
                                : cls.color + '33',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* ── DEBUG TÉCNICO (colapsable) ────────────────────────────── */}
          {isRunning && (
            <div>
              <button
                onClick={() => setShowDebug((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-800 text-xs text-gray-600 hover:text-gray-400 hover:border-gray-700 transition-colors"
              >
                <span>Debug técnico</span>
                <span className="font-mono">{showDebug ? '▲' : '▼'}</span>
              </button>

              {showDebug && (
                <div className="mt-1 p-3 rounded-xl border border-gray-800 bg-gray-950/50 space-y-3">

                  {debug ? (
                    <>
                      {/* COCO-SSD info */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                          COCO-SSD (detector genérico)
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-blue-500">{debug.detectionLabel}</span>
                          <span className="text-xs text-gray-600">{Math.round(debug.detectionScore * 100)}%</span>
                          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-800/60 rounded-full"
                              style={{ width: `${Math.round(debug.detectionScore * 100)}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-700 mt-1">
                          Este label sirve solo para obtener el bbox/crop. No es una clase entrenada.
                        </p>
                      </div>

                      {/* Crop thumbnail */}
                      {debug.cropThumbnail && (
                        <div>
                          <p className="text-[10px] text-gray-600 mb-1">Recorte enviado al clasificador:</p>
                          <img
                            src={debug.cropThumbnail}
                            alt="crop"
                            className="w-16 h-16 rounded-lg object-cover border border-gray-700"
                          />
                        </div>
                      )}

                      {/* Streak + FPS */}
                      <div className="flex justify-between text-[10px] font-mono text-gray-700">
                        <span>streak {debug.streakFrames}/{debug.requiredFrames}</span>
                        {inferenceState.fps > 0 && <span>{inferenceState.fps} fps</span>}
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-700 text-center py-1">
                      Sin objeto en cámara — COCO-SSD no detecta nada
                    </p>
                  )}
                </div>
              )}
            </div>
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
