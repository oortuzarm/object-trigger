import { getDB } from './db'

export async function saveAssetBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await db.put('assets', { id, blob, mimeType: blob.type })
}

export async function loadAssetBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB()
  const record = await db.get('assets', id)
  return record?.blob
}

export async function loadAssetURL(id: string): Promise<string | undefined> {
  const blob = await loadAssetBlob(id)
  if (!blob) return undefined
  return URL.createObjectURL(blob)
}

export async function deleteAssetBlob(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('assets', id)
}
