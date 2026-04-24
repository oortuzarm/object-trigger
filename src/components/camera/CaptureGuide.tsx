import { Badge } from '@/components/ui/Badge'
import type { QualityReport } from '@/types/sample.types'

const MIN_SAMPLES = 20
const RECOMMENDED = 40

interface CaptureGuideProps {
  sampleCount: number
  currentHint: string
  lastQuality: QualityReport | null
  className?: string
}

export default function CaptureGuide({
  sampleCount,
  currentHint,
  lastQuality,
  className = '',
}: CaptureGuideProps) {
  const pct = Math.min(100, (sampleCount / RECOMMENDED) * 100)

  return (
    <div className={['space-y-3', className].join(' ')}>
      {/* Count progress */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400">Muestras capturadas</span>
          <span className="text-sm font-bold font-mono text-gray-200">
            {sampleCount} / {RECOMMENDED}
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-brand-600 to-brand-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-600">Mínimo: {MIN_SAMPLES}</span>
          <span className="text-xs text-gray-600">
            {sampleCount < MIN_SAMPLES
              ? `Faltan ${MIN_SAMPLES - sampleCount} para el mínimo`
              : sampleCount < RECOMMENDED
              ? `Faltan ${RECOMMENDED - sampleCount} para lo recomendado`
              : '¡Dataset completo!'}
          </span>
        </div>
      </div>

      {/* Hint */}
      <div className="bg-brand-950/30 border border-brand-800/30 rounded-xl p-3 flex items-start gap-3">
        <span className="text-brand-400 text-base mt-0.5">💡</span>
        <p className="text-xs text-brand-300 leading-relaxed">{currentHint}</p>
      </div>

      {/* Quality feedback */}
      {lastQuality && (
        <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 space-y-2">
          <span className="text-xs font-medium text-gray-400">Última captura</span>
          <div className="flex flex-wrap gap-1.5">
            {lastQuality.flags.includes('ok') && (
              <Badge variant="success" dot>Buena calidad</Badge>
            )}
            {lastQuality.flags.includes('blur') && (
              <Badge variant="warning" dot>Borrosa</Badge>
            )}
            {lastQuality.flags.includes('dark') && (
              <Badge variant="warning" dot>Oscura</Badge>
            )}
            {lastQuality.flags.includes('similar') && (
              <Badge variant="neutral" dot>Similar a anterior</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <QualityMini label="Nitidez" value={lastQuality.blurScore} />
            <QualityMini label="Brillo" value={Math.min(1, lastQuality.brightnessScore / 0.8)} />
            <QualityMini label="Global" value={lastQuality.overallScore} />
          </div>
        </div>
      )}
    </div>
  )
}

function QualityMini({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="text-center">
      <div className={['text-sm font-bold font-mono', color].join(' ')}>{pct}%</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  )
}
