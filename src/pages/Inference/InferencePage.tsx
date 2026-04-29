import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useCamera } from '@/hooks/useCamera'
import { useInference } from '@/hooks/useInference'
import CameraView from '@/components/camera/CameraView'
import DetectionOverlay from '@/components/overlay/DetectionOverlay'
import InferenceStatusRow from './InferenceControls'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// ── CTA phase state machine ────────────────────────────────────────────────────
// 'error'      — camera permission denied or stream failed
// 'preparing'  — camera started but video not yet ready to display frames
// 'ready'      — video has data, engine idle, safe to start
// 'starting'   — start() called, loading model/embeddings (async)
// 'running'    — inference engine active

type Phase = 'error' | 'preparing' | 'ready' | 'starting' | 'running'

const PHASE_LABEL: Record<Phase, string> = {
  error:      'Cámara no disponible',
  preparing:  'Preparando cámara…',
  ready:      'Iniciar reconocimiento',
  starting:   'Iniciando…',
  running:    'Detener reconocimiento',
}

const PHASE_STATUS: Record<Phase, string> = {
  error:      'Cámara no disponible',
  preparing:  'Preparando cámara…',
  ready:      'Cámara lista',
  starting:   'Iniciando motor…',
  running:    'Reconociendo…',
}

export default function InferencePage() {
  const navigate = useNavigate()
  const { modelStatus, classes, modelClassIds, embeddingCountByClass } = useAppStore()
  const camera = useCamera()
  const { inferenceState, isStarting, start, stop } = useInference(camera.videoRef)
  const [showDebug, setShowDebug] = useState(false)

  const hasEmbeddings = Object.values(embeddingCountByClass).some((count) => count > 0)

  useEffect(() => {
    camera.start()
    return () => {
      camera.stop()
      stop()
    }
  }, [])

  // ── Guard: nothing to recognize ────────────────────────────────────────────
  if (modelStatus !== 'ready' && !hasEmbeddings) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto text-center pt-16 sm:pt-20">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4 text-3xl">
          ⚡
        </div>
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Sin datos de reconocimiento</h2>
        <p className="text-sm text-gray-500 mb-6">
          Captura imágenes en cada clase para generar embeddings, o entrena un clasificador.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate('/classes')} variant="secondary" className="w-full sm:w-auto">
            Crear clases
          </Button>
          <Button onClick={() => navigate('/training')} className="w-full sm:w-auto">
            Ver estado
          </Button>
        </div>
      </div>
    )
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const det = inferenceState.currentDetection
  const debug = inferenceState.debugPrediction
  const activeCls = det ? classes.find((c) => c.id === det.classId) : null
  const isRunning = inferenceState.status === 'running'
  const isEmbeddingsMode = inferenceState.mode === 'embeddings'

  const classIdList = isEmbeddingsMode ? classes.map((c) => c.id) : modelClassIds
  const confidenceLabel = isEmbeddingsMode ? 'similitud' : 'confianza'
  const classCount = isEmbeddingsMode ? classes.length : modelClassIds.length
  const classCountLabel = isEmbeddingsMode
    ? `${classCount} clase${classCount !== 1 ? 's' : ''} con embeddings`
    : `${classCount} clase${classCount !== 1 ? 's' : ''} entrenadas`

  const sortedProbs = debug?.allProbabilities
    ? classIdList
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

  // ── CTA phase ──────────────────────────────────────────────────────────────
  const phase: Phase =
    camera.state.error ? 'error' :
    isRunning          ? 'running' :
    isStarting         ? 'starting' :
    camera.state.isReady ? 'ready' :
    'preparing'

  const ctaDisabled = phase === 'error' || phase === 'preparing' || phase === 'starting'

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-100">Reconocimiento en vivo</h1>
          <p className="text-xs sm:text-sm text-gray-500">{classCountLabel}</p>
        </div>
        {/* Status badges only — no start/stop here */}
        <InferenceStatusRow inferenceState={inferenceState} />
      </div>

      {/* Inference engine errors */}
      {inferenceState.error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-950/40 border border-red-800/30">
          <span className="text-red-400 flex-shrink-0 mt-px">✕</span>
          <p className="text-xs text-red-400 font-mono break-all">{inferenceState.error}</p>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">

        {/* ── Camera ──────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <CameraView
            ref={camera.videoRef}
            isActive={camera.state.isActive}
            error={camera.state.error}
            onFlip={camera.flip}
            className="w-full aspect-[4/3] sm:aspect-video"
          />
          {isRunning && <DetectionOverlay />}
        </div>

        {/* ── Side panel ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* ── CTA — single source of truth for start/stop ─────────────────── */}
          <Card>
            {/* Camera / inference status */}
            <div className="flex items-center gap-2 mb-3">
              <div className={[
                'w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300',
                phase === 'error'     ? 'bg-red-500' :
                phase === 'preparing' ? 'bg-yellow-500 animate-pulse' :
                phase === 'ready'     ? 'bg-green-500' :
                phase === 'starting'  ? 'bg-brand-500 animate-pulse' :
                /* running */           'bg-green-400 animate-pulse',
              ].join(' ')} />
              <span className="text-xs text-gray-400 flex-1">{PHASE_STATUS[phase]}</span>
              {isRunning && inferenceState.fps > 0 && (
                <span className="font-mono text-xs text-gray-600">{inferenceState.fps} FPS</span>
              )}
            </div>

            <Button
              variant={phase === 'running' ? 'danger' : 'primary'}
              className="w-full"
              disabled={ctaDisabled}
              loading={phase === 'starting'}
              onClick={phase === 'running' ? stop : start}
            >
              {PHASE_LABEL[phase]}
            </Button>
          </Card>

          {/* ── RESULTADO PRINCIPAL ──────────────────────────────────────────── */}
          {(isRunning || det) && (
            <Card>
              {det && activeCls ? (
                /* ✅ Confirmed detection */
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
                        {Math.round(det.confidence * 100)}% {confidenceLabel}
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
                /* 🟡 Object visible but not confirmed */
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold text-yellow-500/80 uppercase tracking-wider">
                    Objeto detectado, no reconocido
                  </div>
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

              ) : (
                /* ⚪ Scanning */
                <div className="flex items-center gap-2 text-gray-600 py-1">
                  <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span className="text-sm">Buscando objeto…</span>
                </div>
              )}
            </Card>
          )}

          {/* ── SIMILITUD / CONFIANZA por clase ──────────────────────────────── */}
          {isRunning && debug && (
            <Card>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                {isEmbeddingsMode ? 'Similitud por clase' : 'Confianza por clase'}
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

          {/* ── DEBUG TÉCNICO (colapsable) ────────────────────────────────────── */}
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

                  {/* Mode badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Modo:</span>
                    <span className={[
                      'text-[10px] font-mono px-1.5 py-0.5 rounded',
                      isEmbeddingsMode
                        ? 'text-blue-400 bg-blue-950/40'
                        : 'text-purple-400 bg-purple-950/40',
                    ].join(' ')}>
                      {isEmbeddingsMode ? 'embeddings (similitud coseno)' : 'clasificador (softmax)'}
                    </span>
                  </div>

                  {debug ? (
                    <>
                      {/* Candidate ranking */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                            Candidatos ({debug.candidates.length})
                          </p>
                          {debug.lockedFrames > 0 && (
                            <span className="text-[9px] font-mono text-gray-700">
                              lock {debug.lockedFrames}f
                            </span>
                          )}
                        </div>
                        {debug.candidates.length > 0 ? (
                          <div className="space-y-1">
                            {debug.candidates.slice(0, 4).map((c, i) => (
                              <div
                                key={i}
                                className={[
                                  'rounded-lg px-2 py-1.5',
                                  c.isLocked ? 'bg-yellow-950/30 border border-yellow-900/40' : 'bg-gray-900/50',
                                ].join(' ')}
                              >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={['text-[9px] w-2.5 flex-shrink-0 text-center', c.isLocked ? 'text-yellow-600' : 'text-gray-700'].join(' ')}>
                                    {c.isLocked ? '★' : `${i + 1}`}
                                  </span>
                                  <span className="text-[10px] font-mono text-gray-400 flex-1 truncate">{c.label}</span>
                                  <span className="text-[10px] font-mono font-bold text-gray-200 flex-shrink-0">
                                    {Math.round(c.finalScore * 100)}
                                  </span>
                                </div>
                                <div className="flex gap-2 text-[9px] font-mono text-gray-700 pl-3.5 flex-wrap">
                                  <span>C:{Math.round(c.centerScore * 100)}</span>
                                  <span>A:{Math.round(c.areaScore * 100)}</span>
                                  <span>D:{Math.round(c.detectorScore * 100)}</span>
                                  {c.prescored && (
                                    <>
                                      <span className="text-blue-700">E:{Math.round(c.embeddingScore * 100)}</span>
                                      {c.ocrScore > 0 && (
                                        <span className="text-green-800">O:{Math.round(c.ocrScore * 100)}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                            <p className="text-[9px] text-gray-800 pl-0.5">
                              C=centro · A=área · D=detector · E=embedding · O=ocr
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-700">Sin candidatos válidos</p>
                        )}
                      </div>

                      {/* Selected detection */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                          Seleccionado
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
                      </div>

                      {/* OCR */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                          OCR
                        </p>
                        {debug.ocrText ? (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-mono text-gray-400 break-all leading-relaxed bg-gray-900/60 px-2 py-1.5 rounded-lg">
                              "{debug.ocrText}"
                            </p>
                            {debug.ocrMatchClassId && debug.ocrScore !== null ? (
                              <div className="flex items-start gap-1.5 flex-wrap">
                                <span className={[
                                  'text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0',
                                  debug.ocrMatchType === 'exact'
                                    ? 'bg-green-950/60 text-green-500'
                                    : 'bg-yellow-950/60 text-yellow-500',
                                ].join(' ')}>
                                  {debug.ocrMatchType}
                                </span>
                                <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
                                  {Math.round(debug.ocrScore * 100)}%
                                </span>
                                <span className="text-[10px] text-gray-500 break-all min-w-0">
                                  "<span className="font-mono text-gray-300">{debug.ocrMatchedKeyword}</span>"
                                  {' '}→{' '}
                                  <span className="text-gray-200 font-medium">
                                    {classes.find((c) => c.id === debug.ocrMatchClassId)?.name}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-700">Sin match con keywords configuradas</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-700">
                            {debug.ocrText === null ? 'Sin texto detectado' : 'OCR en progreso…'}
                          </p>
                        )}
                      </div>

                      {/* Crop thumbnail */}
                      {debug.cropThumbnail && (
                        <div>
                          <p className="text-[10px] text-gray-600 mb-1">
                            Recorte enviado al {isEmbeddingsMode ? 'embedder' : 'clasificador'}:
                          </p>
                          <img
                            src={debug.cropThumbnail}
                            alt="crop"
                            className="w-16 h-16 rounded-lg object-cover border border-gray-700"
                          />
                        </div>
                      )}

                      {/* Streak */}
                      <div className="flex justify-between text-[10px] font-mono text-gray-700">
                        <span>streak {debug.streakFrames}/{debug.requiredFrames}</span>
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
