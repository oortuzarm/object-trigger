import { useEffect, useRef, useState } from 'react'
import { getAssetObjectURL } from '@/features/assets/assetManager'
import type { AudioAssetConfig } from '@/types/class.types'

export default function AudioAsset({
  config,
  active,
}: {
  config: AudioAssetConfig
  active: boolean
}) {
  const [url, setUrl] = useState<string | undefined>()
  const audioRef = useRef<HTMLAudioElement>(null)
  const playedRef = useRef(false)

  useEffect(() => {
    getAssetObjectURL(config.blobId).then(setUrl)
  }, [config.blobId])

  useEffect(() => {
    const a = audioRef.current
    if (!a || !url) return
    if (active && config.autoplay && !playedRef.current) {
      a.play().catch(() => {})
      playedRef.current = true
    }
    if (!active) {
      a.pause()
      a.currentTime = 0
      playedRef.current = false
    }
  }, [active, url, config.autoplay])

  if (!url) return null

  return (
    <div className="pointer-events-auto">
      <audio ref={audioRef} src={url} preload="auto" className="hidden" />
      {/* Minimal visual indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
        </svg>
        <span className="text-xs text-white/60">Audio</span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      </div>
    </div>
  )
}
