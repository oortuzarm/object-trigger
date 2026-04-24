import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { classes, hasTrainedModel, modelClassIds } = useAppStore()

  const totalSamples = classes.reduce((acc, c) => acc + c.sampleCount, 0)
  const classesWithSamples = classes.filter((c) => c.sampleCount >= 5)
  const readyToTrain = classesWithSamples.length >= 2

  const steps = [
    {
      number: 1,
      title: 'Crea tus clases',
      desc: 'Define los objetos que quieres reconocer',
      done: classes.length >= 2,
      path: '/classes',
      cta: classes.length === 0 ? 'Crear primera clase' : 'Gestionar clases',
    },
    {
      number: 2,
      title: 'Captura muestras',
      desc: 'Fotografía cada objeto desde distintos ángulos',
      done: totalSamples >= 40,
      path: classes[0] ? `/capture/${classes[0].id}` : '/classes',
      cta: 'Capturar muestras',
    },
    {
      number: 3,
      title: 'Valida el dataset',
      desc: 'Revisa la calidad y variedad de tus muestras',
      done: totalSamples >= 40,
      path: '/dataset',
      cta: 'Ver dataset',
    },
    {
      number: 4,
      title: 'Entrena el modelo',
      desc: 'Entrenamiento local en tu navegador',
      done: hasTrainedModel,
      path: '/training',
      cta: hasTrainedModel ? 'Re-entrenar' : 'Entrenar ahora',
    },
    {
      number: 5,
      title: 'Configura y reconoce',
      desc: 'Añade assets y activa el reconocimiento en vivo',
      done: false,
      path: '/configure',
      cta: 'Configurar',
    },
  ]

  const currentStep = steps.findIndex((s) => !s.done)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-100 mb-1">Dashboard</h1>
        <p className="text-sm text-gray-500">Reconocimiento visual de objetos en el navegador</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Clases" value={classes.length} icon="◈" />
        <StatCard label="Muestras" value={totalSamples} icon="⊙" />
        <StatCard
          label="Modelo"
          value={hasTrainedModel ? 'Listo' : 'Pendiente'}
          icon="⚡"
          valueClass={hasTrainedModel ? 'text-green-400' : 'text-gray-500'}
        />
        <StatCard label="Entrenadas" value={modelClassIds.length} icon="◎" />
      </div>

      {/* Flow steps */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Flujo de trabajo
        </h2>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <StepCard
              key={step.number}
              step={step}
              isCurrent={i === currentStep}
              onClick={() => navigate(step.path)}
            />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      {hasTrainedModel && (
        <Card className="bg-gradient-to-r from-brand-950/60 to-gray-900 border-brand-800/30">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <h3 className="font-semibold text-gray-100 mb-1">Modelo entrenado</h3>
              <p className="text-sm text-gray-400">
                {modelClassIds.length} clase{modelClassIds.length !== 1 ? 's' : ''} listas
              </p>
            </div>
            <Button onClick={() => navigate('/inference')} className="w-full sm:w-auto">
              Iniciar reconocimiento
            </Button>
          </div>
        </Card>
      )}

      {!hasTrainedModel && readyToTrain && (
        <Card className="bg-gradient-to-r from-yellow-950/40 to-gray-900 border-yellow-800/20">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <h3 className="font-semibold text-gray-100 mb-1">Listo para entrenar</h3>
              <p className="text-sm text-gray-400">
                {classesWithSamples.length} clases con muestras suficientes
              </p>
            </div>
            <Button onClick={() => navigate('/training')} variant="secondary" className="w-full sm:w-auto">
              Entrenar modelo
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  valueClass = 'text-gray-100',
}: {
  label: string
  value: string | number
  icon: string
  valueClass?: string
}) {
  return (
    <Card padding="sm">
      <div className="text-base mb-2">{icon}</div>
      <div className={['text-xl sm:text-2xl font-bold font-mono mb-0.5', valueClass].join(' ')}>
        {value}
      </div>
      <div className="text-xs text-gray-500 leading-tight">{label}</div>
    </Card>
  )
}

function StepCard({
  step,
  isCurrent,
  onClick,
}: {
  step: { number: number; title: string; desc: string; done: boolean; cta: string }
  isCurrent: boolean
  onClick: () => void
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 p-3 sm:p-4 rounded-xl border transition-all duration-150 cursor-pointer',
        step.done
          ? 'border-green-800/20 bg-green-950/10'
          : isCurrent
          ? 'border-brand-600/40 bg-brand-950/20 active:bg-brand-950/40'
          : 'border-gray-800/50 bg-gray-900/30 opacity-60',
      ].join(' ')}
      onClick={onClick}
    >
      <div
        className={[
          'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
          step.done
            ? 'bg-green-600/20 text-green-400'
            : isCurrent
            ? 'bg-brand-600 text-white'
            : 'bg-gray-800 text-gray-500',
        ].join(' ')}
      >
        {step.done ? '✓' : step.number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-200 truncate">{step.title}</div>
        <div className="text-xs text-gray-500 truncate">{step.desc}</div>
      </div>
      {(isCurrent || step.done) && (
        <Badge variant={step.done ? 'success' : 'default'} className="flex-shrink-0 hidden sm:inline-flex">
          {step.done ? 'Listo' : step.cta}
        </Badge>
      )}
      {/* Arrow on mobile instead of badge */}
      {isCurrent && (
        <svg className="sm:hidden w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
}
