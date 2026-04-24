import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
      // Debounce so layout doesn't shift mid-tap: click fires ~50ms after touchend,
      // debounce fires 150ms after the last resize event (after keyboard animation ends).
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => setKeyboardOffset(offset), 150)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setKeyboardOffset(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 p-0"
      style={keyboardOffset > 0 ? { paddingBottom: keyboardOffset } : undefined}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => { console.log('[Modal] backdrop click'); onClose() }}
      />
      <div
        className={[
          'relative w-full bg-gray-900 border border-gray-800 shadow-2xl animate-slide-up',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[90dvh] overflow-y-auto',
          'sm:' + sizeClasses[size],
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-gray-100">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-white/5 -mr-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="sm:hidden absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="w-8 h-1 rounded-full bg-gray-700" />
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
