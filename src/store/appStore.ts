import { create } from 'zustand'
import type { ObjectClass } from '@/types/class.types'
import type { TrainingProgress } from '@/types/training.types'
import type { InferenceState } from '@/types/inference.types'

interface AppState {
  // Classes
  classes: ObjectClass[]
  setClasses: (classes: ObjectClass[]) => void
  upsertClass: (cls: ObjectClass) => void
  removeClass: (id: string) => void

  // Model state
  hasTrainedModel: boolean
  modelClassIds: string[]
  setModelReady: (classIds: string[]) => void
  clearModel: () => void

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
    set((state) => ({ classes: state.classes.filter((c) => c.id !== id) })),

  hasTrainedModel: false,
  modelClassIds: [],
  setModelReady: (classIds) => set({ hasTrainedModel: true, modelClassIds: classIds }),
  clearModel: () => set({ hasTrainedModel: false, modelClassIds: [] }),

  trainingProgress: null,
  setTrainingProgress: (progress) => set({ trainingProgress: progress }),

  inferenceState: {
    status: 'idle',
    currentDetection: null,
    fps: 0,
  },
  setInferenceState: (partial) =>
    set((state) => ({ inferenceState: { ...state.inferenceState, ...partial } })),

  activeProjectName: 'Mi Proyecto',
  setActiveProjectName: (name) => set({ activeProjectName: name }),
}))
