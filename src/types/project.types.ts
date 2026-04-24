export interface ProjectMeta {
  id: string
  name: string
  classCount: number
  sampleCount: number
  hasModel: boolean
  createdAt: number
  updatedAt: number
}

export interface Project extends ProjectMeta {
  classIds: string[]
}
