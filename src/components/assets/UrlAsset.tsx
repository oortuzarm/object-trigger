import type { UrlAssetConfig } from '@/types/class.types'

export default function UrlAsset({ config }: { config: UrlAssetConfig }) {
  return (
    <a
      href={config.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-xl transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {config.label || 'Ver más'}
    </a>
  )
}
