import type { InferenceMode, CandidateInfo } from '@/features/inference/inferenceEngine'
import type { OcrMatchType } from '@/features/ocr/ocrMatcher'

export type { InferenceMode, CandidateInfo }
export type { OcrMatchType }

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
  /** Last OCR text extracted from the object crop (normalized: no diacritics, lowercase). */
  ocrText: string | null
  /** Class whose keywords best matched the OCR text. */
  ocrMatchClassId: string | null
  /** Original keyword string that triggered the match. */
  ocrMatchedKeyword: string | null
  /** How the match was found: 'exact' (substring) or 'fuzzy' (Levenshtein). */
  ocrMatchType: OcrMatchType | null
  /** Combined score: rawSimilarity * lengthWeight. Range 0–1, null if no match. */
  ocrScore: number | null
  /** All ranked COCO candidates for this frame (best first). */
  candidates: CandidateInfo[]
  /** Consecutive frames the selected bbox has been locked. */
  lockedFrames: number
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
