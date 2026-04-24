import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { getAllSamples } from '@/features/storage/samplesStore'
import QualityReportCard from './QualityReportCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import type { TrainingSample } from '@/types/sample.types'

export default function DatasetPage() {
  const navigate = useNavigate()
  const { classes } = useAppStore()
  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllSamples()
      .then(setSamples)
      .finally(() => setLoading(false))
  }, [])

  const totalSamples = samples.length
  const avgSamplesPerClass = classes.length > 0 ? totalSamples / classes.length : 0

  const getSamplesForClass = (classId: string) => samples.filter((s) => s.classId === classId)

  const counts = classes.map((c) => getSamplesForClass(c.id).length)
  const minCount = Math.min(...counts)
  const maxCount = Math.max(...counts)
  const isImbalanced = classes.length > 1 && maxCount > 0 && minCount < maxCount * 0.5

  const readyToTrain = classes.length >= 2 && classes.every((c) => getSamplesForClass(c.id).length >= 20)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={<span className="text-2xl">⊙</span>}
          title="Sin clases definidas"
          description="Primero crea tus clases de objetos, luego captura muestras para cada una."
          action={{ label: 'Crear clases', onClick: () => navigate('/classes') }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Dataset</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Calidad y cobertura de tus muestras
          </p>
        </div>
        {readyToTrain && (
          <Button onClick={() => navigate('/training')} size="sm" className="flex-shrink-0">
            Entrenar →
          </Button>
        )}
      </div>

      {/* Summary stats — 3 cols but compact on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
        {[
          { label: 'Total muestras', value: totalSamples },
          { label: 'Promedio / clase', value: Math.round(avgSamplesPerClass) },
          { label: 'Clases', value: classes.length },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 text-center">
            <div className="text-lg sm:text-2xl font-bold font-mono text-gray-100">{s.value}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Warning */}
      {isImbalanced && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl border border-yellow-800/30 bg-yellow-950/20 flex items-start gap-2.5">
          <span className="text-yellow-400 mt-0.5 flex-shrink-0">⚠</span>
          <div>
            <p className="text-sm font-medium text-yellow-300">Dataset desbalanceado</p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Alguna clase tiene más del doble de muestras que otra. Esto puede afectar la precisión.
            </p>
          </div>
        </div>
      )}

      {/* Per-class reports */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {classes.map((cls) => (
          <QualityReportCard key={cls.id} cls={cls} samples={getSamplesForClass(cls.id)} />
        ))}
      </div>

      {readyToTrain && (
        <div className="mt-5 p-3 sm:p-4 rounded-xl border border-green-800/30 bg-green-950/10 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-400 flex-shrink-0">✓</span>
            <p className="text-sm text-green-300 font-medium">Dataset listo para entrenamiento</p>
          </div>
          <Badge variant="success" className="self-start sm:self-auto">≥20 muestras por clase</Badge>
        </div>
      )}
    </div>
  )
}
