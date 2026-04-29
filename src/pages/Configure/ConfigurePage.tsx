import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import ClassConfig from './ClassConfig'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function ConfigurePage() {
  const navigate = useNavigate()
  const { classes } = useAppStore()

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Configurar</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Overlay, umbral y asset por clase
          </p>
        </div>
        {classes.length > 0 && (
          <Button onClick={() => navigate('/inference')} variant="secondary" size="sm" className="flex-shrink-0">
            Probar →
          </Button>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">⊕</span>}
          title="Sin clases"
          description="Crea clases primero para poder configurarlas."
          action={{ label: 'Crear clases', onClick: () => navigate('/classes') }}
        />
      ) : (
        <>
          <div className="mb-4 p-3 rounded-xl bg-gray-900/50 border border-gray-800 text-xs text-gray-500">
            Expande una clase para editar su configuración. Guarda los cambios antes de ejecutar la experiencia.
          </div>
          <div className="space-y-3">
            {classes.map((cls) => (
              <ClassConfig key={cls.id} cls={cls} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
