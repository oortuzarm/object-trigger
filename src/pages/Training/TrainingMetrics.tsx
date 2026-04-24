import type { EpochMetrics } from '@/types/training.types'

interface TrainingMetricsProps {
  metrics: EpochMetrics[]
  totalEpochs: number
}

export default function TrainingMetrics({ metrics, totalEpochs }: TrainingMetricsProps) {
  if (metrics.length === 0) return null

  const last = metrics[metrics.length - 1]
  const maxLoss = Math.max(...metrics.map((m) => m.loss), 1)

  return (
    <div className="space-y-4">
      {/* Current values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricBox label="Pérdida" value={last.loss.toFixed(4)} good={last.loss < 0.5} />
        <MetricBox
          label="Precisión"
          value={`${(last.accuracy * 100).toFixed(1)}%`}
          good={last.accuracy > 0.7}
        />
        {last.valLoss !== undefined && (
          <MetricBox label="Val. Pérdida" value={last.valLoss.toFixed(4)} good={last.valLoss < 0.5} />
        )}
        {last.valAccuracy !== undefined && (
          <MetricBox
            label="Val. Precisión"
            value={`${(last.valAccuracy * 100).toFixed(1)}%`}
            good={last.valAccuracy > 0.65}
          />
        )}
      </div>

      {/* Chart (CSS sparkline) */}
      <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
        <div className="flex justify-between text-xs text-gray-600 mb-3">
          <span>Precisión por época</span>
          <span>{metrics.length}/{totalEpochs} épocas</span>
        </div>
        <div className="h-20 flex items-end gap-0.5">
          {metrics.map((m, i) => {
            const h = Math.max(4, m.accuracy * 80)
            return (
              <div
                key={i}
                className="flex-1 rounded-sm bg-brand-600/60 hover:bg-brand-500/80 transition-colors"
                style={{ height: `${h}px` }}
                title={`Época ${m.epoch}: ${(m.accuracy * 100).toFixed(1)}%`}
              />
            )
          })}
          {/* Fill remaining */}
          {Array.from({ length: Math.max(0, totalEpochs - metrics.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 rounded-sm bg-gray-800" style={{ height: '4px' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricBox({
  label,
  value,
  good,
}: {
  label: string
  value: string
  good: boolean
}) {
  return (
    <div className="bg-gray-950 rounded-xl p-3 border border-gray-800 text-center">
      <div className={['text-lg font-bold font-mono', good ? 'text-green-400' : 'text-yellow-400'].join(' ')}>
        {value}
      </div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  )
}
