import { useLocation, Link } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/classes': 'Clases',
  '/dataset': 'Dataset',
  '/training': 'Entrenamiento',
  '/configure': 'Configurar',
  '/inference': 'Reconocer',
  '/projects': 'Proyectos',
  '/capture': 'Captura',
}

export default function TopBar() {
  const location = useLocation()
  const { activeProjectName, inferenceState } = useAppStore()

  const pathBase = '/' + location.pathname.split('/')[1]
  const pageLabel = routeLabels[pathBase] ?? 'Página'

  return (
    <header className="h-12 lg:h-14 px-4 lg:px-6 flex items-center justify-between border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm flex-shrink-0 gap-2">
      {/* Logo on mobile (sidebar is hidden) */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="lg:hidden w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 32 32" fill="none" className="w-3.5 h-3.5">
            <path d="M8 8h4v4H8zM20 8h4v4h-4zM8 20h4v4H8zM20 20h4v4h-4z" fill="white" opacity="0.6" />
            <rect x="12" y="12" width="8" height="8" rx="2" fill="white" />
          </svg>
        </div>
        {/* Breadcrumb — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-gray-600 truncate max-w-[80px] lg:max-w-none">{activeProjectName}</span>
          <span className="text-gray-700 flex-shrink-0">/</span>
          <span className="text-gray-300 font-medium">{pageLabel}</span>
        </div>
        {/* Page title only on xs */}
        <span className="sm:hidden text-sm font-semibold text-gray-200">{pageLabel}</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {inferenceState.status === 'running' && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-950/60 border border-green-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-xs text-green-400 font-medium hidden sm:inline">
              {inferenceState.fps > 0 ? `${inferenceState.fps} FPS` : 'En vivo'}
            </span>
          </div>
        )}
        <Link
          to="/inference"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
          <span>Reconocer</span>
        </Link>
      </div>
    </header>
  )
}
