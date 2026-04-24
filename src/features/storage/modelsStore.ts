import { getDB } from './db'

export interface StoredModel {
  id: string
  artifacts: unknown
  classIds: string[]
  trainedAt: number
}

const MODEL_KEY = 'current-model'

export async function saveModel(model: Omit<StoredModel, 'id'>): Promise<void> {
  const db = await getDB()
  await db.put('models', { ...model, id: MODEL_KEY })
}

export async function loadModel(): Promise<StoredModel | undefined> {
  const db = await getDB()
  return db.get('models', MODEL_KEY)
}

export async function deleteModel(): Promise<void> {
  const db = await getDB()
  await db.delete('models', MODEL_KEY)
}

export async function hasModel(): Promise<boolean> {
  const model = await loadModel()
  return model !== undefined
}
