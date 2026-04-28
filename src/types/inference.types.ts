export interface DetectionResult {
  classId: string
  className: string
  confidence: number           // average confidence across the stable streak
  timestamp: number
  isAboveThreshold: boolean    // true only when streak + threshold are both met
  allProbabilities?: number[]  // raw softmax for current frame
  cropMethod?: string
  streakFrames: number         // consecutive frames agreeing on this class
  requiredFrames: number       // frames needed to confirm
}

/** Current best guess from the model — always updated while running, shown as debug info. */
export interface DebugPrediction {
  classId: string
  className: string
  confidence: number
  allProbabilities?: number[]
  streakFrames: number
  requiredFrames: number
}

export type InferenceStatus = 'idle' | 'running' | 'no_model' | 'error'

export interface InferenceState {
  status: InferenceStatus
  /** Confirmed stable detection. null = no object confirmed yet. */
  currentDetection: DetectionResult | null
  /** Debug: what the model is currently predicting, regardless of stability. */
  debugPrediction: DebugPrediction | null
  fps: number
  error?: string
}
