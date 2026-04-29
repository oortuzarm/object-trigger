import type { InferenceMode } from '@/features/inference/inferenceEngine'

export type { InferenceMode }

export interface DetectionResult {
  classId: string
  className: string
  confidence: number           // similarity (embeddings mode) or softmax (classifier mode)
  timestamp: number
  isAboveThreshold: boolean
  allProbabilities?: number[]
  cropMethod?: string
  streakFrames: number
  requiredFrames: number
  detectionScore?: number
  detectionLabel?: string
  detectionBbox?: [number, number, number, number]
}

export interface DebugPrediction {
  classId: string
  className: string
  confidence: number
  allProbabilities?: number[]
  streakFrames: number
  requiredFrames: number
  detectionScore: number
  detectionLabel: string
  detectionBbox: [number, number, number, number]
  cropThumbnail: string | null
}

export type InferenceStatus = 'idle' | 'running' | 'no_model' | 'error'

export interface InferenceState {
  status: InferenceStatus
  currentDetection: DetectionResult | null
  debugPrediction: DebugPrediction | null
  /** 'embeddings' = similarity search (no retraining needed). 'classifier' = trained Dense head. */
  mode: InferenceMode
  fps: number
  error?: string
}
