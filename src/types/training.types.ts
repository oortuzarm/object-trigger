export interface TrainingConfig {
  epochs: number
  batchSize: number
  learningRate: number
  validationSplit: number
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  epochs: 30,
  batchSize: 16,
  learningRate: 0.001,
  validationSplit: 0.2,
}

export interface EpochMetrics {
  epoch: number
  loss: number
  accuracy: number
  valLoss?: number
  valAccuracy?: number
}

export type TrainingStatus =
  | 'idle'
  | 'extracting_features'
  | 'training'
  | 'saving'
  | 'done'
  | 'error'

export interface TrainingProgress {
  status: TrainingStatus
  currentEpoch: number
  totalEpochs: number
  metrics: EpochMetrics[]
  message: string
  error?: string
}

export interface TrainingResult {
  modelArtifacts: unknown
  classIds: string[]
  finalAccuracy: number
  finalLoss: number
  trainedAt: number
}

export type WorkerMessage =
  | { type: 'START'; classIds: string[]; config: TrainingConfig }
  | { type: 'PROGRESS'; progress: TrainingProgress }
  | { type: 'DONE'; result: TrainingResult }
  | { type: 'ERROR'; error: string }
