export type QualityFlag = 'blur' | 'dark' | 'similar' | 'ok'

export interface QualityReport {
  flags: QualityFlag[]
  blurScore: number       // 0-1, higher = sharper
  brightnessScore: number // 0-1, higher = brighter
  similarityScore: number // 0-1 similarity to previous sample (lower = more diverse)
  overallScore: number    // 0-1 composite
}

export interface TrainingSample {
  id: string
  classId: string
  blob: Blob
  capturedAt: number
  qualityReport: QualityReport
  thumbnail?: string  // base64 data URL for display
}

export interface DatasetStats {
  totalSamples: number
  samplesPerClass: Record<string, number>
  avgQualityPerClass: Record<string, number>
  isBalanced: boolean
  minSamples: number
  maxSamples: number
}
