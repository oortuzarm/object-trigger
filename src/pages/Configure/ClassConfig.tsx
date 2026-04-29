import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import AssetUploader from './AssetUploader'
import { useClasses } from '@/hooks/useClasses'
import type { ObjectClass, ClassAsset } from '@/types/class.types'

interface ClassConfigProps {
  cls: ObjectClass
}

export default function ClassConfig({ cls }: ClassConfigProps) {
  const { updateClass } = useClasses()
  const [expanded, setExpanded] = useState(false)

  const update = (partial: Partial<ObjectClass>) => {
    updateClass({ ...cls, ...partial })
  }

  return (
    <Card className="transition-all duration-200">
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 text-left touch-manipulation"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: cls.color + '22', color: cls.color }}
        >
          {cls.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-200 text-sm">{cls.name}</div>
          <div className="text-xs text-gray-500">
            {cls.asset ? `Asset: ${cls.asset.type}` : 'Sin asset'} · Umbral:{' '}
            {Math.round(cls.confidenceThreshold * 100)}%
          </div>
        </div>
        <svg
          className={['w-4 h-4 text-gray-500 transition-transform flex-shrink-0', expanded ? 'rotate-180' : ''].join(' ')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5 border-t border-gray-800 pt-5">
          {/* Overlay toggles */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Overlay
            </h4>
            <div className="space-y-3">
              <Toggle
                label="Mostrar nombre"
                checked={cls.showName}
                onChange={(v) => update({ showName: v })}
              />
              <Toggle
                label="Mostrar confianza"
                checked={cls.showConfidence}
                onChange={(v) => update({ showConfidence: v })}
              />
            </div>
          </div>

          {/* Confidence threshold */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Umbral de confianza:{' '}
              <span className="font-mono text-gray-200">{Math.round(cls.confidenceThreshold * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.3}
              max={0.99}
              step={0.01}
              value={cls.confidenceThreshold}
              onChange={(e) => update({ confidenceThreshold: Number(e.target.value) })}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>30% (sensible)</span>
              <span>99% (estricto)</span>
            </div>
          </div>

          {/* OCR keywords */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Palabras clave OCR
            </h4>
            <p className="text-[10px] text-gray-600 mb-2">
              Una por línea. Si el OCR lee estas palabras en la etiqueta, se refuerza la detección.
            </p>
            <textarea
              value={(cls.keywords ?? []).join('\n')}
              onChange={(e) =>
                update({
                  keywords: e.target.value
                    .split('\n')
                    .map((k) => k.trim())
                    .filter(Boolean),
                })
              }
              placeholder={'ej: monterrey\ncafé monterrey\ncafe'}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none font-mono"
            />
          </div>

          {/* Asset */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Asset al detectar
            </h4>
            <AssetUploader
              currentAsset={cls.asset}
              onAssetChange={(asset: ClassAsset | null) => update({ asset })}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  // div instead of label: avoids the iOS double-fire bug where a <label>
  // wrapping a <button> triggers the button click twice on touch.
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm text-gray-300 flex-1">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 touch-manipulation',
          checked ? 'bg-brand-600' : 'bg-gray-700',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
