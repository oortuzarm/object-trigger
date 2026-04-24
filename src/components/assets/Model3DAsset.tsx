import { useEffect, useState } from 'react'
import { getAssetObjectURL } from '@/features/assets/assetManager'
import type { Model3DAssetConfig } from '@/types/class.types'

// model-viewer is loaded via CDN in index.html as a web component
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        'auto-rotate'?: boolean | string
        'camera-controls'?: boolean | string
        'shadow-intensity'?: string
        ar?: boolean | string
        style?: React.CSSProperties
      }, HTMLElement>
    }
  }
}

export default function Model3DAsset({ config }: { config: Model3DAssetConfig }) {
  const [url, setUrl] = useState<string | undefined>()

  useEffect(() => {
    getAssetObjectURL(config.blobId).then(setUrl)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [config.blobId])

  if (!url) return null

  return (
    <div className="w-64 h-64 rounded-xl overflow-hidden shadow-2xl border border-white/10 pointer-events-auto">
      <model-viewer
        src={url}
        auto-rotate={config.autoRotate ? '' : undefined}
        camera-controls=""
        shadow-intensity="1"
        style={{ width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)' }}
      />
    </div>
  )
}
