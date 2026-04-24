import { useEffect, useState } from 'react'
import { getAssetObjectURL } from '@/features/assets/assetManager'
import type { ImageAssetConfig } from '@/types/class.types'

export default function ImageAsset({ config }: { config: ImageAssetConfig }) {
  const [url, setUrl] = useState<string | undefined>()

  useEffect(() => {
    getAssetObjectURL(config.blobId).then(setUrl)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [config.blobId])

  if (!url) return null

  return (
    <img
      src={url}
      alt="asset"
      className="max-w-[60%] max-h-[60%] object-contain rounded-xl shadow-2xl border border-white/10"
    />
  )
}
