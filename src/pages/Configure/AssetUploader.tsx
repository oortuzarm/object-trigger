import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { uploadAsset, removeAsset, ASSET_LABELS } from '@/features/assets/assetManager'
import type { AssetType, ClassAsset, VideoAssetConfig, AudioAssetConfig, Model3DAssetConfig, UrlAssetConfig } from '@/types/class.types'

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

export default function AssetUploader({ currentAsset, onAssetChange }: AssetUploaderProps) {
  const [selectedType, setSelectedType] = useState<AssetType>(currentAsset?.type ?? 'image')
  const [urlValue, setUrlValue] = useState(
    currentAsset?.type === 'url' ? (currentAsset.config as UrlAssetConfig).url : ''
  )
  const [urlLabel, setUrlLabel] = useState(
    currentAsset?.type === 'url' ? (currentAsset.config as UrlAssetConfig).label : 'Ver más'
  )
  const [uploading, setUploading] = useState(false)
  const [videoOpts, setVideoOpts] = useState<Omit<VideoAssetConfig, 'blobId'>>({ autoplay: true, loop: true, muted: true })
  const [audioAutoplay, setAudioAutoplay] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    if (currentAsset && 'blobId' in (currentAsset.config as unknown as Record<string, unknown>)) {
      await removeAsset((currentAsset.config as unknown as { blobId: string }).blobId)
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
    toast.success('URL guardada')
  }

  const handleRemove = async () => {
    if (currentAsset && 'blobId' in (currentAsset.config as unknown as Record<string, unknown>)) {
      await removeAsset((currentAsset.config as unknown as { blobId: string }).blobId)
    }
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

      {/* URL type — wrapped in form for Enter key support on mobile */}
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
            Guardar URL
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          {/* Options per type */}
          {selectedType === 'video' && (
            <div className="flex flex-wrap gap-3">
              {(['autoplay', 'loop', 'muted'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoOpts[opt]}
                    onChange={(e) => setVideoOpts((v) => ({ ...v, [opt]: e.target.checked }))}
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
                onChange={(e) => setAudioAutoplay(e.target.checked)}
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
                onChange={(e) => setAutoRotate(e.target.checked)}
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
