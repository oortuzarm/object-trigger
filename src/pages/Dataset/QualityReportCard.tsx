import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import type { ObjectClass } from '@/types/class.types'
import type { TrainingSample } from '@/types/sample.types'

const MIN_SAMPLES = 20
const RECOMMENDED = 40

interface QualityReportCardProps {
  cls: ObjectClass
  samples: TrainingSample[]
}

export default function QualityReportCard({ cls, samples }: QualityReportCardProps) {
  const navigate = useNavigate()
  const count = samples.length
  const blurry = samples.filter((s) => s.qualityReport.flags.includes('blur')).length
  const dark = samples.filter((s) => s.qualityReport.flags.includes('dark')).length
  const avgQuality =
    count > 0
      ? samples.reduce((a, s) => a + s.qualityReport.overallScore, 0) / count
      : 0

  const datasetStatus =
    count === 0
      ? { label: 'Sin muestras', variant: 'danger' as const }
      : count < MIN_SAMPLES
      ? { label: 'Insuficiente', variant: 'warning' as const }
      : count < RECOMMENDED
      ? { label: 'Aceptable', variant: 'info' as const }
      : { label: 'Completo', variant: 'success' as const }

  return (
    <Card className="hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: cls.color + '22', color: cls.color }}
          >
            {cls.name[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-200">{cls.name}</h3>
            <p className="text-xs text-gray-500">{count} muestras</p>
          </div>
        </div>
        <Badge variant={datasetStatus.variant}>{datasetStatus.label}</Badge>
      </div>

      {/* Progress */}
      <Progress
        value={(count / RECOMMENDED) * 100}
        color={count < MIN_SAMPLES ? 'bg-red-500' : count < RECOMMENDED ? 'bg-yellow-500' : 'bg-green-500'}
        showLabel
        label="Muestras"
        size="sm"
      />

      {count > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-3 gap-3">
          <Stat label="Calidad media" value={`${Math.round(avgQuality * 100)}%`} good={avgQuality > 0.6} />
          <Stat label="Borrosas" value={blurry} good={blurry < count * 0.2} invert />
          <Stat label="Oscuras" value={dark} good={dark < count * 0.2} invert />
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/capture/${cls.id}`)}
        className="w-full mt-3"
      >
        {count === 0 ? 'Capturar muestras' : 'Añadir más'}
      </Button>
    </Card>
  )
}

function Stat({
  label,
  value,
  good,
  invert = false,
}: {
  label: string
  value: string | number
  good: boolean
  invert?: boolean
}) {
  const ok = invert ? !good : good
  return (
    <div className="text-center">
      <div className={['text-sm font-bold font-mono', ok ? 'text-green-400' : 'text-yellow-400'].join(' ')}>
        {typeof value === 'number' ? value : value}
      </div>
      <div className="text-xs text-gray-600 mt-0.5">{label}</div>
    </div>
  )
}
