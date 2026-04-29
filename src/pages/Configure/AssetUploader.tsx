import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { uploadAsset, removeAsset, ASSET_LABELS } from '@/features/assets/assetManager'
import type {
  AssetType,
  ClassAsset,
  VideoAssetConfig,
  AudioAssetConfig,
  Model3DAssetConfig,
  UrlAssetConfig,
} from '@/types/class.types'

interface AssetUploaderProps {
  currentAsset: ClassAsset | null
  onAssetChange: (asset: ClassAsset | null) => void
}

const ASSET_TYPES: AssetType[] = ['image', 'video', 'audio', 'model3d', 'url']

const ACCEPT_MAP: Record<AssetType, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm',
  audio: 'audio/mpeg,audio/ogg,audio/wav',
  model3d: '.glb,application/octet-stream',
  url: '',
}

/** Extract blobId from any asset config, or null if type is 'url' / no asset. */
function getBlobId(asset: ClassAsset | null | undefined): string | null {
  if (!asset || asset.type === 'url') return null
  const cfg = asset.config as unknown as Record<string, unknown>
  return typeof cfg.blobId === 'string' ? cfg.blobId : null
}

export default function AssetUploader({ currentAsset, onAssetChange }: AssetUploaderProps) {
  const [selectedType, setSelectedType] = useState<AssetType>(currentAsset?.type ?? 'image')
  const [urlValue, setUrlValue] = useState(
    currentAsset?.type === 'url' ? (currentAsset.config as UrlAssetConfig).url : ''
  )
  const [urlLabel, setUrlLabel] = useState(
    currentAsset?.type === 'url' ? (currentAsset.config as UrlAssetConfig).label : 'Ver más'
  )
  const [uploading, setUploading] = useState(false)

  // ── Initialize options from the saved asset config, not hardcoded defaults ──
  const [videoOpts, setVideoOpts] = useState<Omit<VideoAssetConfig, 'blobId'>>(() => {
    if (currentAsset?.type === 'video') {
      const c = currentAsset.config as VideoAssetConfig
      return { autoplay: c.autoplay, loop: c.loop, muted: c.muted }
    }
    return { autoplay: true, loop: true, muted: true }
  })
  const [audioAutoplay, setAudioAutoplay] = useState<boolean>(() =>
    currentAsset?.type === 'audio'
      ? (currentAsset.config as AudioAssetConfig).autoplay
      : true
  )
  const [autoRotate, setAutoRotate] = useState<boolean>(() =>
    currentAsset?.type === 'model3d'
      ? (currentAsset.config as Model3DAssetConfig).autoRotate
      : true
  )

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Option change handlers — propagate to parent draft immediately ──────────

  const handleVideoOptsChange = (patch: Partial<Omit<VideoAssetConfig, 'blobId'>>) => {
    const updated = { ...videoOpts, ...patch }
    setVideoOpts(updated)
    // If a video file is already attached, update its config in the parent draft
    if (currentAsset?.type === 'video') {
      const blobId = (currentAsset.config as VideoAssetConfig).blobId
      onAssetChange({ type: 'video', config: { blobId, ...updated } })
    }
  }

  const handleAudioAutoplayChange = (v: boolean) => {
    setAudioAutoplay(v)
    if (currentAsset?.type === 'audio') {
      const blobId = (currentAsset.config as AudioAssetConfig).blobId
      onAssetChange({ type: 'audio', config: { blobId, autoplay: v } })
    }
  }

  const handleAutoRotateChange = (v: boolean) => {
    setAutoRotate(v)
    if (currentAsset?.type === 'model3d') {
      const blobId = (currentAsset.config as Model3DAssetConfig).blobId
      onAssetChange({ type: 'model3d', config: { blobId, autoRotate: v } })
    }
  }

  // ── File upload ────────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    // Delete the current draft's blob immediately to avoid orphan blobs on
    // consecutive uploads without saving (each new upload replaces the previous).
    const existingBlobId = getBlobId(currentAsset)
    if (existingBlobId) {
      await removeAsset(existingBlobId)
    }

    setUploading(true)
    try {
      const blobId = await uploadAsset(file)
      let config: ClassAsset['config']
      if (selectedType === 'video') config = { blobId, ...videoOpts }
      else if (selectedType === 'audio') config = { blobId, autoplay: audioAutoplay }
      else if (selectedType === 'model3d') config = { blobId, autoRotate }
      else config = { blobId }

      onAssetChange({ type: selectedType, config })
      toast.success(`${ASSET_LABELS[selectedType]} subido correctamente`)
    } catch {
      toast.error('Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlSave = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!urlValue.trim()) return
    onAssetChange({
      type: 'url',
      config: { url: urlValue.trim(), label: urlLabel.trim() || 'Ver más' },
    })
  }

  // ── Removal — blob deletion is deferred to save time in the parent ─────────
  // The parent (ClassConfig.handleSave) compares old vs new blobId and deletes
  // the orphan blob when the user clicks "Guardar cambios".
  const handleRemove = () => {
    onAssetChange(null)
    toast.success('Asset eliminado')
  }

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Tipo de asset</label>
        <div className="flex flex-wrap gap-2">
          {ASSET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className={[
                'px-3 py-1.5 text-xs rounded-lg border transition-all touch-manipulation',
                selectedType === t
                  ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600',
              ].join(' ')}
            >
              {ASSET_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Current asset badge */}
      {currentAsset && (
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            {ASSET_LABELS[currentAsset.type]} configurado
          </Badge>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-500 hover:text-red-400 transition-colors touch-manipulation py-1 px-2"
          >
            Eliminar
          </button>
        </div>
      )}

      {/* URL type */}
      {selectedType === 'url' ? (
        <form onSubmit={handleUrlSave} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">URL</label>
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://..."
              enterKeyHint="next"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Texto del botón</label>
            <input
              type="text"
              value={urlLabel}
              onChange={(e) => setUrlLabel(e.target.value)}
              placeholder="Ver más"
              enterKeyHint="done"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <Button type="submit" size="sm" disabled={!urlValue.trim()}>
            Aplicar URL
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          {/* Per-type options */}
          {selectedType === 'video' && (
            <div className="flex flex-wrap gap-3">
              {(['autoplay', 'loop', 'muted'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoOpts[opt]}
                    onChange={(e) => handleVideoOptsChange({ [opt]: e.target.checked })}
                    className="accent-brand-500 w-4 h-4"
                  />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
          )}
          {selectedType === 'audio' && (
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={audioAutoplay}
                onChange={(e) => handleAudioAutoplayChange(e.target.checked)}
                className="accent-brand-500 w-4 h-4"
              />
              Autoplay al detectar
            </label>
          )}
          {selectedType === 'model3d' && (
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={(e) => handleAutoRotateChange(e.target.checked)}
                className="accent-brand-500 w-4 h-4"
              />
              Auto-rotación
            </label>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_MAP[selectedType]}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Subiendo...' : `Subir ${ASSET_LABELS[selectedType]}`}
          </Button>
        </div>
      )}
    </div>
  )
}
