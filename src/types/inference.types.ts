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
  // COCO-SSD detection info
  detectionScore?: number
  detectionLabel?: string
  detectionBbox?: [number, number, number, number]
}

/** Current best guess from the model — updated every frame while COCO-SSD sees an object. */
export interface DebugPrediction {
  classId: string
  className: string
  confidence: number
  allProbabilities?: number[]
  streakFrames: number
  requiredFrames: number
  // COCO-SSD detection info attached to each frame
  detectionScore: number
  detectionLabel: string
  detectionBbox: [number, number, number, number]
}

export type InferenceStatus = 'idle' | 'running' | 'no_model' | 'error'

export interface InferenceState {
  status: InferenceStatus
  /** Confirmed stable detection. null = no object confirmed yet. */
  currentDetection: DetectionResult | null
  /**
   * Live per-frame best guess — only set when COCO-SSD sees an object.
   * null = no object in frame (classifier did not run).
   */
  debugPrediction: DebugPrediction | null
  fps: number
  error?: string
}
