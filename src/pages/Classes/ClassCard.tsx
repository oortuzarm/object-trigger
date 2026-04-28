import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { ObjectClass } from '@/types/class.types'

const MIN_SAMPLES = 20
const RECOMMENDED_SAMPLES = 40

interface ClassCardProps {
  cls: ObjectClass
  onEdit: () => void
  onDelete: () => void
}

export default function ClassCard({ cls, onEdit, onDelete }: ClassCardProps) {
  const navigate = useNavigate()
  const pct = Math.min(100, (cls.sampleCount / RECOMMENDED_SAMPLES) * 100)
  const status =
    cls.sampleCount === 0
      ? 'empty'
      : cls.sampleCount < MIN_SAMPLES
      ? 'insufficient'
      : cls.sampleCount < RECOMMENDED_SAMPLES
      ? 'ok'
      : 'good'

  const statusBadge = {
    empty: <Badge variant="neutral">Sin muestras</Badge>,
    insufficient: <Badge variant="warning">{cls.sampleCount} muestras</Badge>,
    ok: <Badge variant="info">{cls.sampleCount} muestras</Badge>,
    good: <Badge variant="success">{cls.sampleCount} muestras</Badge>,
  }[status]

  return (
    <Card className="flex flex-col gap-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ backgroundColor: cls.color + '33', border: `1px solid ${cls.color}40` }}
          >
            <span style={{ color: cls.color }}>{cls.name[0].toUpperCase()}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{cls.name}</h3>
            {cls.asset && (
              <span className="text-xs text-gray-500 capitalize">{cls.asset.type} configurado</span>
            )}
          </div>
        </div>
        {/* 36×36px touch targets for reliable tap on mobile */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors touch-manipulation"
            aria-label="Editar clase"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors touch-manipulation"
            aria-label="Eliminar clase"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sample progress */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          {statusBadge}
          <span className="text-xs text-gray-600">{RECOMMENDED_SAMPLES} recomendadas</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: cls.color }}
          />
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => navigate(`/capture/${cls.id}`)}
        className="w-full"
      >
        {cls.sampleCount === 0 ? 'Capturar muestras' : 'Añadir muestras'}
      </Button>
    </Card>
  )
}
