import { openDB, type IDBPDatabase } from 'idb'
import type { ObjectClass } from '@/types/class.types'
import type { TrainingSample } from '@/types/sample.types'
import type { Project } from '@/types/project.types'

export const DB_NAME = 'object-trigger'
export const DB_VERSION = 2

export interface StoredEmbeddingRecord {
  id: string        // same as the sample id it was derived from
  classId: string
  vector: number[]  // 1024-dim L2-normalized MobileNet embedding
  capturedAt: number
}

export interface DBSchema {
  classes: {
    key: string
    value: ObjectClass
  }
  samples: {
    key: string
    value: TrainingSample
    indexes: { 'by-class': string }
  }
  models: {
    key: string
    value: { id: string; artifacts: unknown; classIds: string[]; trainedAt: number }
  }
  assets: {
    key: string
    value: { id: string; blob: Blob; mimeType: string }
  }
  projects: {
    key: string
    value: Project
  }
  embeddings: {
    key: string
    value: StoredEmbeddingRecord
    indexes: { 'by-class': string }
  }
}

let dbPromise: Promise<IDBPDatabase<DBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<DBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('classes')) {
          db.createObjectStore('classes', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('samples')) {
          const store = db.createObjectStore('samples', { keyPath: 'id' })
          store.createIndex('by-class', 'classId')
        }
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }
        // v2: per-sample embeddings for classifier-free similarity search
        if (!db.objectStoreNames.contains('embeddings')) {
          const store = db.createObjectStore('embeddings', { keyPath: 'id' })
          store.createIndex('by-class', 'classId')
        }
      },
    })
  }
  return dbPromise
}
