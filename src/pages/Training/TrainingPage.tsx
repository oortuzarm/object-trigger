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

export default function TrainingPage() {
  const navigate = useNavigate()
  const { classes, modelStatus, modelClassIds } = useAppStore()
  const { trainingProgress, startTraining, cancelTraining } = useTraining()
  const [config, setConfig] = useState<TrainingConfig>(DEFAULT_TRAINING_CONFIG)

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

  const perClassAccuracy = trainingProgress?.perClassAccuracy

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Entrenamiento</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Transfer learning en el navegador · augmentación automática (4×)
          </p>
        </div>
        {modelStatus === 'ready' && (
          <Badge variant="success" dot className="flex-shrink-0 mt-1">
            {modelClassIds.length} clase{modelClassIds.length !== 1 ? 's' : ''}
          </Badge>
        )}
        {modelStatus === 'outdated' && (
          <Badge variant="warning" dot className="flex-shrink-0 mt-1">
            Desactualizado
          </Badge>
        )}
      </div>

      {/* Dataset summary */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Resumen del dataset</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <SummaryItem label="Clases" value={classes.length} min={2} />
          <SummaryItem label="Muestras orig." value={totalSamples} min={20} />
          <SummaryItem
            label="Con augmentación"
            value={totalSamples * 4}
            min={40}
            note="4×"
          />
        </div>
        {!canTrain && (
          <p className="text-xs text-yellow-500 mt-3">
            Necesitas al menos 2 clases con muestras para entrenar.{' '}
            <button onClick={() => navigate('/classes')} className="underline hover:text-yellow-400">
              Ir a clases
            </button>
          </p>
        )}
      </Card>

      {/* Config */}
      {!isRunning && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Configuración</h2>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField
              label="Épocas"
              value={config.epochs}
              min={5}
              max={100}
              onChange={(v) => setConfig((c) => ({ ...c, epochs: v }))}
            />
            <ConfigField
              label="Batch size"
              value={config.batchSize}
              min={4}
              max={64}
              onChange={(v) => setConfig((c) => ({ ...c, batchSize: v }))}
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-3">
            Más épocas mejoran la precisión pero pueden causar sobreajuste. Con augmentación activa, 20–40 épocas es suficiente para la mayoría de los casos.
          </p>
        </Card>
      )}

      {/* Progress */}
      {trainingProgress && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-sm font-semibold text-gray-400">Progreso</h2>
            <Badge
              variant={
                trainingProgress.status === 'done'
                  ? 'success'
                  : trainingProgress.status === 'error'
                  ? 'danger'
                  : 'default'
              }
              dot
              className="flex-shrink-0"
            >
              {trainingProgress.status === 'extracting_features'
                ? 'Extrayendo features'
                : trainingProgress.status === 'training'
                ? 'Entrenando'
                : trainingProgress.status === 'evaluating'
                ? 'Evaluando'
                : trainingProgress.status === 'saving'
                ? 'Guardando'
                : trainingProgress.status === 'done'
                ? 'Completado'
                : 'Error'}
            </Badge>
          </div>

          <Progress
            value={epochProgress}
            showLabel
            label={trainingProgress.message}
            color={
              trainingProgress.status === 'done'
                ? 'bg-green-500'
                : trainingProgress.status === 'error'
                ? 'bg-red-500'
                : 'bg-brand-500'
            }
          />

          <div className="mt-4">
            <TrainingMetrics metrics={trainingProgress.metrics} totalEpochs={config.epochs} />
          </div>
        </Card>
      )}

      {/* Per-class accuracy — shown after training completes */}
      {trainingProgress?.status === 'done' && perClassAccuracy && perClassAccuracy.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-1">Precisión por clase</h2>
          <p className="text-[10px] text-gray-600 mb-3">
            Medida sobre muestras originales (sin augmentación). Clases con precisión baja necesitan más muestras o mayor variedad.
          </p>
          <div className="space-y-3">
            {perClassAccuracy.map(({ classId, correct, total }) => {
              const cls = classes.find((c) => c.id === classId)
              const acc = total > 0 ? correct / total : 0
              const pct = Math.round(acc * 100)
              const good = acc >= 0.8
              const warn = acc >= 0.6 && acc < 0.8

              return (
                <div key={classId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {cls && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cls.color }}
                        />
                      )}
                      <span className="text-sm text-gray-300 truncate">
                        {cls?.name ?? classId}
                      </span>
                      <span className="text-xs text-gray-600 flex-shrink-0">
                        {correct}/{total} correctas
                      </span>
                    </div>
                    <span
                      className={[
                        'text-sm font-mono font-bold flex-shrink-0',
                        good ? 'text-green-400' : warn ? 'text-yellow-400' : 'text-red-400',
                      ].join(' ')}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: good ? '#22c55e' : warn ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                  {!good && (
                    <p className="text-[10px] text-gray-600">
                      {acc < 0.6
                        ? 'Precisión baja — captura más muestras con variedad de ángulos, distancias e iluminación.'
                        : 'Precisión moderada — agrega algunas muestras adicionales para mejorar.'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isRunning ? (
          <Button variant="danger" onClick={cancelTraining} className="flex-1">
            Cancelar entrenamiento
          </Button>
        ) : (
          <>
            <Button
              onClick={() => startTraining(config)}
              disabled={!canTrain}
              className="flex-1"
            >
              {modelStatus !== 'not_trained' ? 'Re-entrenar' : 'Iniciar entrenamiento'}
            </Button>
            {trainingProgress?.status === 'done' && (
              <Button onClick={() => navigate('/inference')} variant="secondary" className="sm:flex-shrink-0">
                Ir a reconocimiento →
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SummaryItem({ label, value, min, note }: { label: string; value: number; min: number; note?: string }) {
  const ok = value >= min
  return (
    <div className="text-center p-2 sm:p-3 bg-gray-950 rounded-xl border border-gray-800">
      <div className={['text-lg sm:text-xl font-bold font-mono', ok ? 'text-gray-100' : 'text-red-400'].join(' ')}>
        {value}
        {note && <span className="text-xs text-gray-500 ml-1">{note}</span>}
      </div>
      <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">{label}</div>
      {!ok && <div className="text-[10px] text-red-500 mt-0.5">Mín: {min}</div>}
    </div>
  )
}

function ConfigField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
      />
    </div>
  )
}
