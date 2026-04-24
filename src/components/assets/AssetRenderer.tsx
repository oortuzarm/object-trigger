import type { ClassAsset, ImageAssetConfig, VideoAssetConfig, AudioAssetConfig, Model3DAssetConfig, UrlAssetConfig } from '@/types/class.types'
import ImageAsset from './ImageAsset'
import VideoAsset from './VideoAsset'
import AudioAsset from './AudioAsset'
import Model3DAsset from './Model3DAsset'
import UrlAsset from './UrlAsset'

interface AssetRendererProps {
  asset: ClassAsset
  active: boolean
}

export default function AssetRenderer({ asset, active }: AssetRendererProps) {
  switch (asset.type) {
    case 'image':
      return <ImageAsset config={asset.config as ImageAssetConfig} />
    case 'video':
      return <VideoAsset config={asset.config as VideoAssetConfig} active={active} />
    case 'audio':
      return <AudioAsset config={asset.config as AudioAssetConfig} active={active} />
    case 'model3d':
      return <Model3DAsset config={asset.config as Model3DAssetConfig} />
    case 'url':
      return <UrlAsset config={asset.config as UrlAssetConfig} />
    default:
      return null
  }
}
