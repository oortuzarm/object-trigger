import { create } from 'zustand'
import type { ObjectClass } from '@/types/class.types'
import type { TrainingProgress } from '@/types/training.types'
import type { InferenceState } from '@/types/inference.types'

export type ModelStatus = 'not_trained' | 'ready' | 'outdated'

interface AppState {
  // Classes
  classes: ObjectClass[]
  setClasses: (classes: ObjectClass[]) => void
  upsertClass: (cls: ObjectClass) => void
  removeClass: (id: string) => void

  // Classifier model state
  modelStatus: ModelStatus
  modelClassIds: string[]
  setModelReady: (classIds: string[]) => void
  clearModel: () => void

  // Embedding index counts (classId → number of stored embeddings)
  embeddingCountByClass: Record<string, number>
  setEmbeddingCounts: (counts: Record<string, number>) => void

  // Training
  trainingProgress: TrainingProgress | null
  setTrainingProgress: (progress: TrainingProgress | null) => void

  // Inference
  inferenceState: InferenceState
  setInferenceState: (state: Partial<InferenceState>) => void

  // UI
  activeProjectName: string
  setActiveProjectName: (name: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  classes: [],
  setClasses: (classes) => set({ classes }),
  upsertClass: (cls) =>
    set((state) => {
      const idx = state.classes.findIndex((c) => c.id === cls.id)
      if (idx >= 0) {
        const updated = [...state.classes]
        updated[idx] = cls
        return { classes: updated }
      }
      return { classes: [...state.classes, cls] }
    }),
  removeClass: (id) =>
    set((state) => {
      const newClasses = state.classes.filter((c) => c.id !== id)
      let { modelStatus, modelClassIds } = state

      if (newClasses.length === 0) {
        modelStatus = 'not_trained'
        modelClassIds = []
      } else if (state.modelStatus === 'ready' && state.modelClassIds.includes(id)) {
        modelStatus = 'outdated'
      }

      // Remove embedding count for this class
      const embeddingCountByClass = { ...state.embeddingCountByClass }
      delete embeddingCountByClass[id]

      return { classes: newClasses, modelStatus, modelClassIds, embeddingCountByClass }
    }),

  modelStatus: 'not_trained',
  modelClassIds: [],
  setModelReady: (classIds) => set({ modelStatus: 'ready', modelClassIds: classIds }),
  clearModel: () => set({ modelStatus: 'not_trained', modelClassIds: [] }),

  embeddingCountByClass: {},
  setEmbeddingCounts: (counts) =>
    set((state) => ({
      embeddingCountByClass: { ...state.embeddingCountByClass, ...counts },
    })),

  trainingProgress: null,
  setTrainingProgress: (progress) => set({ trainingProgress: progress }),

  inferenceState: {
    status: 'idle',
    currentDetection: null,
    debugPrediction: null,
    mode: 'embeddings',
    fps: 0,
  },
  setInferenceState: (partial) =>
    set((state) => ({ inferenceState: { ...state.inferenceState, ...partial } })),

  activeProjectName: 'Mi Proyecto',
  setActiveProjectName: (name) => set({ activeProjectName: name }),
}))
