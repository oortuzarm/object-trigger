import { forwardRef } from 'react'

interface CameraViewProps {
  isActive: boolean
  error: string | null
  onFlip?: () => void
  className?: string
  /** Content rendered inside the camera container (e.g. DetectionOverlay).
   *  Positioned relative to the camera bounds; clipped by overflow: hidden. */
  children?: React.ReactNode
}

const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(
  ({ isActive, error, onFlip, className = '', children }, ref) => {
    return (
      <div className={['relative bg-gray-900 rounded-2xl overflow-hidden', className].join(' ')}>
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={[
            'w-full h-full object-cover',
            isActive ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />

        {/* Overlay children — always after <video> so they appear on top */}
        {children}

        {/* Placeholder when not active */}
        {!isActive && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 pointer-events-none">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Cámara inactiva</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 text-red-400 p-4 text-center pointer-events-none">
            <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">Error de cámara</span>
            <span className="text-xs text-red-500/70 mt-1">{error}</span>
          </div>
        )}

        {/* Frame guide — corners only */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border border-white/10 rounded-xl">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/40 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/40 rounded-br" />
            </div>
          </div>
        )}

        {/* Flip button */}
        {isActive && onFlip && (
          <button
            onClick={onFlip}
            className="absolute bottom-3 right-3 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    )
  }
)

CameraView.displayName = 'CameraView'
export default CameraView
