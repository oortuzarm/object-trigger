import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { InferenceState } from '@/types/inference.types'

interface InferenceControlsProps {
  inferenceState: InferenceState
  onStart: () => void
  onStop: () => void
}

export default function InferenceControls({
  inferenceState,
  onStart,
  onStop,
}: InferenceControlsProps) {
  const isRunning = inferenceState.status === 'running'

  return (
    <div className="flex items-center gap-3">
      {isRunning && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-mono text-xs">{inferenceState.fps} FPS</span>
        </div>
      )}

      {inferenceState.currentDetection && (
        <Badge variant="success" dot>
          {inferenceState.currentDetection.className} —{' '}
          {Math.round(inferenceState.currentDetection.confidence * 100)}%
        </Badge>
      )}

      <Button
        variant={isRunning ? 'danger' : 'primary'}
        size="sm"
        onClick={isRunning ? onStop : onStart}
      >
        {isRunning ? (
          <>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Detener
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Iniciar
          </>
        )}
      </Button>
    </div>
  )
}
