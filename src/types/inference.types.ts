export interface DetectionResult {
  classId: string
  className: string
  confidence: number    // 0-1
  timestamp: number
  isAboveThreshold: boolean
}

export type InferenceStatus = 'idle' | 'running' | 'no_model' | 'error'

export interface InferenceState {
  status: InferenceStatus
  currentDetection: DetectionResult | null
  fps: number
  error?: string
}
