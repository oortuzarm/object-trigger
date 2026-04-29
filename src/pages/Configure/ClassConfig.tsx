import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import AssetUploader from './AssetUploader'
import { useClasses } from '@/hooks/useClasses'
import { removeAsset } from '@/features/assets/assetManager'
import type { ObjectClass, ClassAsset } from '@/types/class.types'

interface ClassConfigProps {
  cls: ObjectClass
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Returns the blobId from any file-based asset config (null for URL or no asset). */
function getBlobId(asset: ClassAsset | null | undefined): string | null {
  if (!asset || asset.type === 'url') return null
  const cfg = asset.config as unknown as Record<string, unknown>
  return typeof cfg.blobId === 'string' ? cfg.blobId : null
}

export default function ClassConfig({ cls }: ClassConfigProps) {
  const { updateClass } = useClasses()
  const [expanded, setExpanded] = useState(false)

  // ── Draft state ────────────────────────────────────────────────────────────
  // All edits accumulate here. Nothing reaches IDB/Zustand until handleSave.
  const [draft, setDraft] = useState<ObjectClass>(cls)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When the user navigates to a different class (cls.id changes), reset the
  // draft. We intentionally do NOT reset when cls data changes from external
  // writes (e.g. sampleCount update) to preserve in-progress edits.
  useEffect(() => {
    setDraft(cls)
    setSaveState('idle')
  }, [cls.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty detection ────────────────────────────────────────────────────────
  const isDirty =
    draft.showName !== cls.showName ||
    draft.showConfidence !== cls.showConfidence ||
    draft.confidenceThreshold !== cls.confidenceThreshold ||
    (draft.keywords ?? []).join('\n') !== (cls.keywords ?? []).join('\n') ||
    JSON.stringify(draft.asset) !== JSON.stringify(cls.asset)

  const updateDraft = (partial: Partial<ObjectClass>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSaveState('saving')
    try {
      // Delete the old blob if the asset was removed or replaced.
      // This is deferred here (not in AssetUploader) so the blob is only
      // deleted when the user confirms the change by saving.
      const oldBlobId = getBlobId(cls.asset)
      const newBlobId = getBlobId(draft.asset)
      if (oldBlobId && oldBlobId !== newBlobId) {
        try { await removeAsset(oldBlobId) } catch { /* non-fatal if already deleted */ }
      }

      await updateClass({ ...draft, updatedAt: Date.now() })
      setSaveState('saved')
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }

  return (
    <Card className="transition-all duration-200">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-gray-200 text-sm truncate">{cls.name}</span>
            {isDirty && (
              <span className="text-[9px] font-semibold text-yellow-600 bg-yellow-950/50 border border-yellow-900/40 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 whitespace-nowrap">
                Sin guardar
              </span>
            )}
            {!isDirty && saveState === 'saved' && (
              <span className="text-[9px] font-semibold text-green-600 bg-green-950/50 border border-green-900/40 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                Guardado ✓
              </span>
            )}
          </div>
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

      {/* ── Expanded content ────────────────────────────────────────────────── */}
      {expanded && (
        <div className="mt-5 space-y-5 border-t border-gray-800 pt-5">

          {/* Overlay toggles */}
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Overlay
            </h4>
            <div className="space-y-3">
              <Toggle
                label="Mostrar nombre"
                checked={draft.showName}
                onChange={(v) => updateDraft({ showName: v })}
              />
              <Toggle
                label="Mostrar confianza"
                checked={draft.showConfidence}
                onChange={(v) => updateDraft({ showConfidence: v })}
              />
            </div>
          </section>

          {/* Confidence threshold */}
          <section>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Umbral de confianza:{' '}
              <span className="font-mono text-gray-200">{Math.round(draft.confidenceThreshold * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.3}
              max={0.99}
              step={0.01}
              value={draft.confidenceThreshold}
              onChange={(e) => updateDraft({ confidenceThreshold: Number(e.target.value) })}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>30% (sensible)</span>
              <span>99% (estricto)</span>
            </div>
          </section>

          {/* OCR keywords */}
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Palabras clave OCR
            </h4>
            <p className="text-[10px] text-gray-600 mb-2">
              Una por línea. Si el OCR lee estas palabras en la etiqueta, se refuerza la detección.
            </p>
            <textarea
              value={(draft.keywords ?? []).join('\n')}
              onChange={(e) =>
                updateDraft({
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
          </section>

          {/* Asset — key ensures AssetUploader remounts when asset type changes,
              re-reading options from the updated draft.asset */}
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Asset al detectar
            </h4>
            <AssetUploader
              key={draft.asset?.type ?? 'none'}
              currentAsset={draft.asset}
              onAssetChange={(asset: ClassAsset | null) => updateDraft({ asset })}
            />
          </section>

          {/* ── Save bar ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-800/60">
            <span
              className={[
                'text-xs transition-opacity duration-200',
                isDirty
                  ? 'text-yellow-600 opacity-100'
                  : saveState === 'saved'
                    ? 'text-green-500 opacity-100'
                    : saveState === 'error'
                      ? 'text-red-500 opacity-100'
                      : 'opacity-0 pointer-events-none',
              ].join(' ')}
            >
              {isDirty
                ? 'Cambios sin guardar'
                : saveState === 'saved'
                  ? 'Guardado correctamente'
                  : saveState === 'error'
                    ? 'Error al guardar — intenta de nuevo'
                    : ' '}
            </span>
            <Button
              size="sm"
              loading={saveState === 'saving'}
              disabled={!isDirty || saveState === 'saving'}
              onClick={handleSave}
              className="flex-shrink-0"
            >
              {saveState === 'saved' && !isDirty ? 'Guardado ✓' : 'Guardar cambios'}
            </Button>
          </div>

        </div>
      )}
    </Card>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

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
