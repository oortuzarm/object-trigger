export type AssetType = 'image' | 'video' | 'audio' | 'model3d' | 'url'

export interface ImageAssetConfig {
  blobId: string
}

export interface VideoAssetConfig {
  blobId: string
  autoplay: boolean
  loop: boolean
  muted: boolean
}

export interface AudioAssetConfig {
  blobId: string
  autoplay: boolean
}

export interface Model3DAssetConfig {
  blobId: string
  autoRotate: boolean
}

export interface UrlAssetConfig {
  url: string
  label: string
}

export type AssetConfig =
  | ImageAssetConfig
  | VideoAssetConfig
  | AudioAssetConfig
  | Model3DAssetConfig
  | UrlAssetConfig

export interface ClassAsset {
  type: AssetType
  config: AssetConfig
}

export interface ObjectClass {
  id: string
  name: string
  color: string
  confidenceThreshold: number
  showName: boolean
  showConfidence: boolean
  asset: ClassAsset | null
  sampleCount: number
  createdAt: number
  updatedAt: number
}

export const CLASS_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
]

import { generateId } from '@/utils/generateId'

export function createObjectClass(name: string, color?: string): ObjectClass {
  return {
    id: generateId(),
    name,
    color: color ?? CLASS_COLORS[Math.floor(Math.random() * CLASS_COLORS.length)],
    confidenceThreshold: 0.75,
    showName: true,
    showConfidence: true,
    asset: null,
    sampleCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
