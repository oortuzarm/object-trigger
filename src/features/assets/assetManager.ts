import { saveAssetBlob, loadAssetURL, deleteAssetBlob } from '@/features/storage/assetsStore'

export async function uploadAsset(file: File): Promise<string> {
  const id = crypto.randomUUID()
  await saveAssetBlob(id, file)
  return id
}

export async function getAssetObjectURL(blobId: string): Promise<string | undefined> {
  return loadAssetURL(blobId)
}

export async function removeAsset(blobId: string): Promise<void> {
  await deleteAssetBlob(blobId)
}

export const ACCEPTED_MIME: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp3'],
  model3d: ['model/gltf-binary', 'application/octet-stream'],
}

export const ASSET_LABELS: Record<string, string> = {
  image: 'Imagen',
  video: 'Video',
  audio: 'Audio',
  model3d: 'Modelo 3D (.glb)',
  url: 'URL externa',
}
