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
    trainingProgress?.status === 'saving'

  const epochProgress =
    trainingProgress && trainingProgress.totalEpochs > 0
      ? (trainingProgress.currentEpoch / trainingProgress.totalEpochs) * 100
      : 0

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Entrenamiento</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Transfer learning en el navegador
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
          <SummaryItem label="Muestras" value={totalSamples} min={20} />
          <SummaryItem
            label="Promedio"
            value={classes.length > 0 ? Math.round(totalSamples / classes.length) : 0}
            min={10}
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
                ? 'Features'
                : trainingProgress.status === 'training'
                ? 'Entrenando'
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

function SummaryItem({ label, value, min }: { label: string; value: number; min: number }) {
  const ok = value >= min
  return (
    <div className="text-center p-2 sm:p-3 bg-gray-950 rounded-xl border border-gray-800">
      <div className={['text-lg sm:text-xl font-bold font-mono', ok ? 'text-gray-100' : 'text-red-400'].join(' ')}>
        {value}
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
