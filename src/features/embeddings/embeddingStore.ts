import { getDB } from '@/features/storage/db'
import type { StoredEmbeddingRecord } from '@/features/storage/db'

export type { StoredEmbeddingRecord }

export async function saveEmbedding(emb: StoredEmbeddingRecord): Promise<void> {
  const db = await getDB()
  await db.put('embeddings', emb)
}

export async function getEmbeddingsByClass(classId: string): Promise<StoredEmbeddingRecord[]> {
  const db = await getDB()
  return db.getAllFromIndex('embeddings', 'by-class', classId)
}

export async function getAllEmbeddings(): Promise<StoredEmbeddingRecord[]> {
  const db = await getDB()
  return db.getAll('embeddings')
}

export async function deleteEmbedding(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('embeddings', id)
}

export async function deleteEmbeddingsByClass(classId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('embeddings', 'readwrite')
  const index = tx.store.index('by-class')
  let cursor = await index.openCursor(classId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function countEmbeddingsByClass(classId: string): Promise<number> {
  const db = await getDB()
  return db.countFromIndex('embeddings', 'by-class', classId)
}

/** Returns { classId → count } for all classes that have at least one embedding. */
export async function getEmbeddingCountsMap(): Promise<Record<string, number>> {
  const all = await getAllEmbeddings()
  const counts: Record<string, number> = {}
  for (const e of all) {
    counts[e.classId] = (counts[e.classId] ?? 0) + 1
  }
  return counts
}
