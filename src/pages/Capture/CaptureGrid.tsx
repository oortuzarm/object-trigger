import type { TrainingSample } from '@/types/sample.types'

interface CaptureGridProps {
  samples: TrainingSample[]
  onDelete: (id: string) => void
}

export default function CaptureGrid({ samples, onDelete }: CaptureGridProps) {
  if (samples.length === 0) {
    return (
      <div className="text-center py-6 text-gray-600 text-sm">
        Aún no hay muestras — captura con el botón de arriba
      </div>
    )
  }

  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 sm:gap-2">
      {[...samples].reverse().map((s) => (
        <div key={s.id} className="relative group aspect-square">
          {s.thumbnail ? (
            <img
              src={s.thumbnail}
              alt="muestra"
              className="w-full h-full object-cover rounded-lg border border-gray-800 group-hover:border-gray-600 transition-colors"
            />
          ) : (
            <div className="w-full h-full rounded-lg bg-gray-800 border border-gray-700" />
          )}

          {/* Quality dots */}
          {s.qualityReport.flags.includes('blur') && (
            <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-yellow-500 rounded-full opacity-90" title="Borrosa" />
          )}
          {s.qualityReport.flags.includes('dark') && (
            <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full opacity-90" title="Oscura" />
          )}

          {/* Delete on hover/tap */}
          <button
            onClick={() => onDelete(s.id)}
            className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
