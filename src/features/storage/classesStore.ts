import { getDB } from './db'
import type { ObjectClass } from '@/types/class.types'

export async function getAllClasses(): Promise<ObjectClass[]> {
  const db = await getDB()
  return db.getAll('classes')
}

export async function getClass(id: string): Promise<ObjectClass | undefined> {
  const db = await getDB()
  return db.get('classes', id)
}

export async function saveClass(cls: ObjectClass): Promise<void> {
  const db = await getDB()
  await db.put('classes', { ...cls, updatedAt: Date.now() })
}

export async function deleteClass(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('classes', id)
}

export async function updateSampleCount(classId: string, count: number): Promise<void> {
  const db = await getDB()
  const cls = await db.get('classes', classId)
  if (cls) {
    await db.put('classes', { ...cls, sampleCount: count, updatedAt: Date.now() })
  }
}
