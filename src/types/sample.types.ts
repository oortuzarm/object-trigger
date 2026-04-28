import type { CropInfo } from '@/features/segmentation/objectCropper'

export type { CropInfo }

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
  blob: Blob             // training image — cropped to the object when detection succeeded
  capturedAt: number
  qualityReport: QualityReport
  thumbnail?: string     // data URL of the cropped image, for UI display
  cropInfo?: CropInfo    // how the crop was made; undefined for samples captured before this feature
}

export interface DatasetStats {
  totalSamples: number
  samplesPerClass: Record<string, number>
  avgQualityPerClass: Record<string, number>
  isBalanced: boolean
  minSamples: number
  maxSamples: number
}
