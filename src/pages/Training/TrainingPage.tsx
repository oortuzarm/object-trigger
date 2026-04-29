import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useTraining } from '@/hooks/useTraining'
import TrainingMetrics from './TrainingMetrics'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { DEFAULT_TRAINING_CONFIG } from '@/types/training.types'
import type { TrainingConfig } from '@/types/training.types'
import { getSamplesByClass } from '@/features/storage/samplesStore'
import { loadFeatureExtractor, extractFeatures } from '@/features/training/featureExtractor'
import { generateEmbedding } from '@/features/embeddings/embeddingEngine'
import { saveEmbedding, getEmbeddingCountsMap } from '@/features/embeddings/embeddingStore'

export default function TrainingPage() {
  const navigate = useNavigate()
  const { classes, modelStatus, modelClassIds, embeddingCountByClass, setEmbeddingCounts } = useAppStore()
  const { trainingProgress, startTraining, cancelTraining } = useTraining()
  const [config, setConfig] = useState<TrainingConfig>(DEFAULT_TRAINING_CONFIG)
  const [regenerating, setRegenerating] = useState(false)
  const [regenProgress, setRegenProgress] = useState('')
  const [showClassifier, setShowClassifier] = useState(false)

  const totalSamples = classes.reduce((a, c) => a + c.sampleCount, 0)
  const canTrain = classes.length >= 2 && totalSamples >= 10
  const isRunning =
    trainingProgress?.status === 'extracting_features' ||
    trainingProgress?.status === 'training' ||
    trainingProgress?.status === 'saving' ||
    trainingProgress?.status === 'evaluating'

  const epochProgress =
    trainingProgress && trainingProgress.totalEpochs > 0
      ? (trainingProgress.currentEpoch / trainingProgress.totalEpochs) * 100
      : 0

  const totalEmbeddings = Object.values(embeddingCountByClass).reduce((a, b) => a + b, 0)
  const embeddingsReady = classes.length > 0 && classes.every((c) => (embeddingCountByClass[c.id] ?? 0) > 0)

  // Regenerate embeddings from all existing sample blobs.
  // Used when samples were captured before the embedding system was added.
  const handleRegenerate = async () => {
    if (regenerating) return
    setRegenerating(true)
    setRegenProgress('Cargando MobileNet…')
    try {
      await loadFeatureExtractor()
      let done = 0
      const total = totalSamples
      for (const cls of classes) {
        const samples = await getSamplesByClass(cls.id)
        for (const s of samples) {
          // Decode blob → canvas → embedding (same pipeline as capture)
          const bitmap = await createImageBitmap(s.blob)
          const canvas = document.createElement('canvas')
          canvas.width = 224
          canvas.height = 224
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0, 224, 224)
          bitmap.close()
          const vector = await generateEmbedding(canvas)
          await saveEmbedding({
            id: s.id,
            classId: cls.id,
            vector: Array.from(vector),
            capturedAt: s.capturedAt,
          })
          done++
          setRegenProgress(`Generando embeddings: ${done}/${total}`)
        }
      }
      const counts = await getEmbeddingCountsMap()
      setEmbeddingCounts(counts)
      setRegenProgress('Listo')
    } catch (err) {
      setRegenProgress(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Reconocimiento</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Basado en embeddings — no requiere reentrenar al agregar clases
          </p>
        </div>
      </div>

      {/* ── Embedding index status ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-semibold text-gray-400">Índice de embeddings</h2>
          {embeddingsReady ? (
            <Badge variant="success" dot>Listo para reconocer</Badge>
          ) : (
            <Badge variant="warning" dot>Embeddings pendientes</Badge>
          )}
        </div>

        <div className="space-y-2 mb-4">
          {classes.map((cls) => {
            const count = embeddingCountByClass[cls.id] ?? 0
            const good = count >= 10
            return (
              <div key={cls.id} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
                <span className="text-sm text-gray-300 flex-1 truncate">{cls.name}</span>
                <span className={[
                  'text-xs font-mono flex-shrink-0',
                  count === 0 ? 'text-red-500' : good ? 'text-green-400' : 'text-yellow-400',
                ].join(' ')}>
                  {count} embed.
                </span>
                {count === 0 && <span className="text-[10px] text-red-600">Sin datos</span>}
              </div>
            )
          })}
          {classes.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-2">
              No hay clases. <button onClick={() => navigate('/classes')} className="underline">Crear clases →</button>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-600">
            {totalEmbeddings > 0
              ? `${totalEmbeddings} embeddings almacenados · Nuevas capturas se indexan automáticamente`
              : 'Captura imágenes en cada clase para generar embeddings'}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRegenerate}
            disabled={regenerating || totalSamples === 0}
            className="flex-shrink-0 w-full sm:w-auto"
          >
            {regenerating ? regenProgress : 'Regenerar desde muestras'}
          </Button>
        </div>

        {regenProgress && !regenerating && (
          <p className="text-xs text-green-500 mt-2">{regenProgress}</p>
        )}
      </Card>

      {/* ── Go to inference ────────────────────────────────────────────────── */}
      {embeddingsReady && (
        <div className="mb-4">
          <Button onClick={() => navigate('/inference')} className="w-full">
            Ir a reconocimiento →
          </Button>
        </div>
      )}

      {/* ── Classifier (advanced, collapsible) ────────────────────────────── */}
      <button
        onClick={() => setShowClassifier((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-800 text-sm text-gray-500 hover:text-gray-400 hover:border-gray-700 transition-colors mb-2"
      >
        <span>Clasificador entrenado <span className="text-[10px] text-gray-600 ml-1">(opcional / experimental)</span></span>
        <span className="font-mono text-xs">{showClassifier ? '▲' : '▼'}</span>
      </button>

      {showClassifier && (
        <div className="space-y-4">
          <Card>
            <p className="text-xs text-gray-600 mb-4">
              El clasificador entrenado se usa como fallback cuando no hay embeddings. Con embeddings disponibles, el clasificador no se usa. Puedes entrenarlo para comparar precisión.
            </p>

            {/* Dataset summary */}
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Dataset</h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
              <SummaryItem label="Clases" value={classes.length} min={2} />
              <SummaryItem label="Muestras" value={totalSamples} min={20} />
              <SummaryItem label="Con aug. (4×)" value={totalSamples * 4} min={40} note="4×" />
            </div>
            {!canTrain && (
              <p className="text-xs text-yellow-500 mb-4">
                Necesitas al menos 2 clases con muestras.
              </p>
            )}

            {/* Config */}
            {!isRunning && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <ConfigField label="Épocas" value={config.epochs} min={5} max={100}
                  onChange={(v) => setConfig((c) => ({ ...c, epochs: v }))} />
                <ConfigField label="Batch size" value={config.batchSize} min={4} max={64}
                  onChange={(v) => setConfig((c) => ({ ...c, batchSize: v }))} />
              </div>
            )}

            {/* Progress */}
            {trainingProgress && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Badge
                    variant={trainingProgress.status === 'done' ? 'success' : trainingProgress.status === 'error' ? 'danger' : 'default'}
                    dot
                  >
                    {trainingProgress.status === 'extracting_features' ? 'Extrayendo'
                      : trainingProgress.status === 'training' ? 'Entrenando'
                      : trainingProgress.status === 'evaluating' ? 'Evaluando'
                      : trainingProgress.status === 'saving' ? 'Guardando'
                      : trainingProgress.status === 'done' ? 'Completado'
                      : 'Error'}
                  </Badge>
                  {modelStatus === 'ready' && <Badge variant="success" dot>{modelClassIds.length} clases</Badge>}
                </div>
                <Progress
                  value={epochProgress}
                  showLabel
                  label={trainingProgress.message}
                  color={trainingProgress.status === 'done' ? 'bg-green-500' : trainingProgress.status === 'error' ? 'bg-red-500' : 'bg-brand-500'}
                />
                <div className="mt-3">
                  <TrainingMetrics metrics={trainingProgress.metrics} totalEpochs={config.epochs} />
                </div>
              </div>
            )}

            {/* Per-class accuracy */}
            {trainingProgress?.status === 'done' && trainingProgress.perClassAccuracy && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Precisión por clase (muestras originales)
                </h3>
                <div className="space-y-2">
                  {trainingProgress.perClassAccuracy.map(({ classId, correct, total }) => {
                    const cls = classes.find((c) => c.id === classId)
                    const acc = total > 0 ? correct / total : 0
                    const pct = Math.round(acc * 100)
                    const good = acc >= 0.8
                    const warn = acc >= 0.6 && acc < 0.8
                    return (
                      <div key={classId} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-300 flex-1 truncate">{cls?.name ?? classId}</span>
                          <span className="text-xs text-gray-600">{correct}/{total}</span>
                          <span className={['text-xs font-mono font-bold', good ? 'text-green-400' : warn ? 'text-yellow-400' : 'text-red-400'].join(' ')}>{pct}%</span>
                        </div>
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: good ? '#22c55e' : warn ? '#eab308' : '#ef4444' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {isRunning ? (
                <Button variant="danger" onClick={cancelTraining} className="flex-1">
                  Cancelar
                </Button>
              ) : (
                <Button onClick={() => startTraining(config)} disabled={!canTrain} className="flex-1">
                  {modelStatus !== 'not_trained' ? 'Re-entrenar clasificador' : 'Entrenar clasificador'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function SummaryItem({ label, value, min, note }: { label: string; value: number; min: number; note?: string }) {
  const ok = value >= min
  return (
    <div className="text-center p-2 sm:p-3 bg-gray-950 rounded-xl border border-gray-800">
      <div className={['text-lg sm:text-xl font-bold font-mono', ok ? 'text-gray-100' : 'text-red-400'].join(' ')}>
        {value}{note && <span className="text-xs text-gray-500 ml-1">{note}</span>}
      </div>
      <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">{label}</div>
    </div>
  )
}

function ConfigField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-brand-500" />
    </div>
  )
}
