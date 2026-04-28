import { create } from 'zustand'
import { generateId } from '@/utils/generateId'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: ToastItem[]
  add: (type: ToastType, message: string) => void
  remove: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = generateId()
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (msg: string) => useToastStore.getState().add('success', msg),
  error: (msg: string) => useToastStore.getState().add('error', msg),
  warning: (msg: string) => useToastStore.getState().add('warning', msg),
  info: (msg: string) => useToastStore.getState().add('info', msg),
}

const iconMap: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'i',
}

const colorMap: Record<ToastType, string> = {
  success: 'border-green-600/40 bg-green-950/80 text-green-300',
  error: 'border-red-600/40 bg-red-950/80 text-red-300',
  warning: 'border-yellow-600/40 bg-yellow-950/80 text-yellow-300',
  info: 'border-brand-600/40 bg-brand-950/80 text-brand-300',
}

const iconColorMap: Record<ToastType, string> = {
  success: 'bg-green-600/30 text-green-400',
  error: 'bg-red-600/30 text-red-400',
  warning: 'bg-yellow-600/30 text-yellow-400',
  info: 'bg-brand-600/30 text-brand-400',
}

function ToastItem({ toast: t }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove)
  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl animate-slide-up',
        colorMap[t.type],
      ].join(' ')}
    >
      <span className={['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', iconColorMap[t.type]].join(' ')}>
        {iconMap[t.type]}
      </span>
      <span className="text-sm font-medium flex-1">{t.message}</span>
      <button
        type="button"
        onClick={() => remove(t.id)}
        className="w-6 h-6 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity touch-manipulation flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    // Mobile: full-width above the bottom nav (bottom-20 clears nav ~56px + safe area).
    // sm+: fixed bottom-right corner.
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
