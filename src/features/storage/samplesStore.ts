import { getDB } from './db'
import type { TrainingSample } from '@/types/sample.types'

export async function getSamplesByClass(classId: string): Promise<TrainingSample[]> {
  const db = await getDB()
  return db.getAllFromIndex('samples', 'by-class', classId)
}

export async function getAllSamples(): Promise<TrainingSample[]> {
  const db = await getDB()
  return db.getAll('samples')
}

export async function saveSample(sample: TrainingSample): Promise<void> {
  const db = await getDB()
  await db.put('samples', sample)
}

export async function deleteSample(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('samples', id)
}

export async function deleteSamplesByClass(classId: string): Promise<void> {
  const db = await getDB()
  const samples = await db.getAllFromIndex('samples', 'by-class', classId)
  const tx = db.transaction('samples', 'readwrite')
  await Promise.all(samples.map(s => tx.store.delete(s.id)))
  await tx.done
}

export async function countSamplesByClass(classId: string): Promise<number> {
  const db = await getDB()
  const samples = await db.getAllFromIndex('samples', 'by-class', classId)
  return samples.length
}
