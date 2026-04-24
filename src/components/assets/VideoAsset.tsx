import { useEffect, useRef, useState } from 'react'
import { getAssetObjectURL } from '@/features/assets/assetManager'
import type { VideoAssetConfig } from '@/types/class.types'

export default function VideoAsset({
  config,
  active,
}: {
  config: VideoAssetConfig
  active: boolean
}) {
  const [url, setUrl] = useState<string | undefined>()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    getAssetObjectURL(config.blobId).then(setUrl)
  }, [config.blobId])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !url) return
    if (active && config.autoplay) {
      v.play().catch(() => {})
    } else if (!active) {
      v.pause()
      v.currentTime = 0
    }
  }, [active, url, config.autoplay])

  if (!url) return null

  return (
    <video
      ref={videoRef}
      src={url}
      loop={config.loop}
      muted={config.muted}
      playsInline
      className="max-w-[70%] max-h-[70%] rounded-xl shadow-2xl border border-white/10 pointer-events-auto"
      controls={!config.autoplay}
    />
  )
}
