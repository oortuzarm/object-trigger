export interface DetectionResult {
  classId: string
  className: string
  confidence: number           // winning class probability (0-1)
  timestamp: number
  isAboveThreshold: boolean
  allProbabilities?: number[]  // raw softmax vector, indexed by training classIds order
  cropMethod?: string          // 'cocoSsd' | 'saliency' | 'center'
}

export type InferenceStatus = 'idle' | 'running' | 'no_model' | 'error'

export interface InferenceState {
  status: InferenceStatus
  currentDetection: DetectionResult | null
  fps: number
  error?: string
}
