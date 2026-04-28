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

  const det = inferenceState.currentDetection     // confirmed stable
  const debug = inferenceState.debugPrediction    // live frame — only set when COCO-SSD sees object
  const activeCls = det ? classes.find((c) => c.id === det.classId) : null
  const debugCls = debug ? classes.find((c) => c.id === debug.classId) : null
  const isRunning = inferenceState.status === 'running'

  const streakPct = debug ? Math.min(100, (debug.streakFrames / debug.requiredFrames) * 100) : 0

  // Top-3 probabilities sorted descending for debug panel
  const top3 = debug?.allProbabilities
    ? [...modelClassIds.map((id, idx) => ({ id, idx, prob: debug.allProbabilities![idx] ?? 0 }))]
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3)
    : []

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

          {/* ── State: confirmed detection ─────────────────────────────── */}
          <Card>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Detección activa
            </h3>

            {det && activeCls ? (
              /* ✅ Confirmed stable class */
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: activeCls.color + '22', color: activeCls.color }}
                  >
                    {det.className[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-100 truncate">{det.className}</div>
                    <div className="text-xs text-gray-400">
                      {Math.round(det.confidence * 100)}% confianza · {det.streakFrames} frames
                    </div>
                  </div>
                  <span className="text-green-400 text-lg flex-shrink-0">✓</span>
                </div>

                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.round(det.confidence * 100)}%`, backgroundColor: activeCls.color }}
                  />
                </div>

                {det.detectionLabel && (
                  <div className="text-[10px] text-gray-600 font-mono">
                    detector: {det.detectionLabel} ({Math.round((det.detectionScore ?? 0) * 100)}%)
                  </div>
                )}
              </div>

            ) : isRunning && debug ? (
              /* 🔍 COCO-SSD found object — building streak */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
                  <span className="text-sm text-gray-300">
                    {debugCls ? `Candidato: ${debugCls.name} (${Math.round(debug.confidence * 100)}%)` : 'Analizando…'}
                  </span>
                </div>

                {/* Streak progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>Estabilidad temporal</span>
                    <span>{debug.streakFrames}/{debug.requiredFrames} frames</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150 bg-yellow-600"
                      style={{ width: `${streakPct}%` }}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-gray-600 font-mono space-y-0.5">
                  <div>detector: <span className="text-gray-500">{debug.detectionLabel}</span> {Math.round(debug.detectionScore * 100)}%</div>
                  {debugCls && (
                    <div>umbral: {Math.round((debugCls.confidenceThreshold ?? 0.75) * 100)}%
                      {debug.confidence < (debugCls.confidenceThreshold ?? 0.75) && (
                        <span className="text-yellow-700"> · confianza insuficiente</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

            ) : isRunning ? (
              /* ⬜ Running but no COCO-SSD detection */
              <div className="flex items-center gap-2 text-gray-600 py-2">
                <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="text-sm">Buscando objeto…</span>
              </div>

            ) : (
              /* ⚪ Idle */
              <div className="text-center py-4 text-gray-700">
                <div className="text-2xl mb-1">◎</div>
                <p className="text-xs">Inactivo</p>
              </div>
            )}
          </Card>

          {/* ── Debug: live probabilities ──────────────────────────────── */}
          {isRunning && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Probabilidades
                </h3>
                {debug ? (
                  <span className="text-[10px] font-mono text-yellow-600/80">objeto detectado</span>
                ) : (
                  <span className="text-[10px] font-mono text-gray-700">sin objeto</span>
                )}
              </div>

              {debug ? (
                <div className="space-y-2">
                  {/* All classes sorted by probability */}
                  {[...modelClassIds.map((id, idx) => ({
                    id, idx, prob: debug.allProbabilities?.[idx] ?? 0,
                  }))]
                    .sort((a, b) => b.prob - a.prob)
                    .map(({ id, prob }, rank) => {
                      const cls = classes.find((c) => c.id === id)
                      if (!cls) return null
                      const isWinner = debug.classId === id
                      const isConfirmed = det?.classId === id
                      const isTop3 = rank < 3

                      return (
                        <div key={id} className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {rank === 0 && <span className="text-[9px] text-yellow-600">▲</span>}
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: isWinner ? cls.color : cls.color + '44' }}
                              />
                              <span className={[
                                'text-xs truncate',
                                isConfirmed ? 'text-green-400 font-medium'
                                  : isWinner ? 'text-gray-200 font-medium'
                                  : isTop3 ? 'text-gray-400'
                                  : 'text-gray-600',
                              ].join(' ')}>
                                {cls.name}
                                {isConfirmed && ' ✓'}
                              </span>
                            </div>
                            <span className={[
                              'text-xs font-mono flex-shrink-0',
                              isConfirmed ? 'text-green-400' : isWinner ? 'text-yellow-500' : 'text-gray-600',
                            ].join(' ')}>
                              {Math.round(prob * 100)}%
                            </span>
                          </div>
                          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-200"
                              style={{
                                width: `${Math.round(prob * 100)}%`,
                                backgroundColor: isConfirmed ? cls.color
                                  : isWinner ? cls.color + '99'
                                  : cls.color + '33',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}

                  {/* Footer: streak + fps */}
                  <div className="flex justify-between text-[10px] text-gray-700 pt-1 font-mono">
                    <span>streak {debug.streakFrames}/{debug.requiredFrames}</span>
                    {inferenceState.fps > 0 && <span>{inferenceState.fps} fps</span>}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-700 py-3 text-center">
                  El clasificador no corre sin detección previa
                </div>
              )}
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
