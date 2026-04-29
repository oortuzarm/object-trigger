import { Badge } from '@/components/ui/Badge'
import type { InferenceState } from '@/types/inference.types'

interface InferenceStatusRowProps {
  inferenceState: InferenceState
}

/** Header status indicators — read-only. Start/stop lives in the side panel CTA only. */
export default function InferenceStatusRow({ inferenceState }: InferenceStatusRowProps) {
  const isRunning = inferenceState.status === 'running'

  if (!isRunning && !inferenceState.currentDetection) return null

  return (
    <div className="flex items-center gap-3">
      {isRunning && inferenceState.fps > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="font-mono text-xs text-gray-400">{inferenceState.fps} FPS</span>
        </div>
      )}
      {inferenceState.currentDetection && (
        <Badge variant="success" dot>
          {inferenceState.currentDetection.className} —{' '}
          {Math.round(inferenceState.currentDetection.confidence * 100)}%
        </Badge>
      )}
    </div>
  )
}
