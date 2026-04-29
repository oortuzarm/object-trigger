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
  /** Last OCR text extracted from the object crop (cleaned, lowercase). */
  ocrText: string | null
  /** Class whose keywords matched the OCR text, if any. */
  ocrMatchClassId: string | null
  /** Specific keyword that triggered the match. */
  ocrMatchedKeyword: string | null
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
