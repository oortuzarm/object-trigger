import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'

interface NavItem {
  path: string
  label: string
  icon: string
  badge?: string | number
}

export default function Sidebar() {
  const { hasTrainedModel, classes } = useAppStore()
  const totalSamples = classes.reduce((acc, c) => acc + c.sampleCount, 0)

  const navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: '⊞' },
    { path: '/classes', label: 'Clases', icon: '◈', badge: classes.length || undefined },
    { path: '/dataset', label: 'Dataset', icon: '⊙', badge: totalSamples || undefined },
    { path: '/training', label: 'Entrenamiento', icon: '⚡' },
    { path: '/configure', label: 'Configurar', icon: '⊕' },
    { path: '/inference', label: 'Reconocer', icon: '◎' },
    { path: '/projects', label: 'Proyectos', icon: '◱' },
  ]

  // Bottom nav shows the 5 most-used items on mobile
  const bottomNavItems = navItems.slice(0, 6)

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 bg-gray-950 border-r border-gray-800/60 flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4">
                <path d="M8 8h4v4H8zM20 8h4v4h-4zM8 20h4v4H8zM20 20h4v4h-4z" fill="white" opacity="0.6" />
                <rect x="12" y="12" width="8" height="8" rx="2" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-gray-100 text-sm">Object Trigger</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150',
                  isActive
                    ? 'bg-brand-600/20 text-brand-300 font-medium'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/5',
                ].join(' ')
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full font-mono">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div className="px-4 py-4 border-t border-gray-800/60">
          <div className="flex items-center gap-2">
            <div
              className={[
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                hasTrainedModel ? 'bg-green-400' : 'bg-gray-600',
              ].join(' ')}
            />
            <span className="text-xs text-gray-500">
              {hasTrainedModel ? 'Modelo listo' : 'Sin modelo'}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800/60 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors relative',
                isActive ? 'text-brand-400' : 'text-gray-600',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-500" />
                )}
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 flex items-center justify-center text-[9px] bg-brand-600 text-white rounded-full font-mono leading-none">
                    {Number(item.badge) > 9 ? '9+' : item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
