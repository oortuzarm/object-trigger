import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import DetectionLabel from './DetectionLabel'
import AssetRenderer from '@/components/assets/AssetRenderer'

const FADE_DELAY_MS = 1500

export default function DetectionOverlay() {
  const { inferenceState, classes } = useAppStore()
  const { currentDetection, debugPrediction } = inferenceState
  const [visible, setVisible] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cls = classes.find((c) => c.id === currentDetection?.classId)

  useEffect(() => {
    if (currentDetection && cls) {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      setVisible(true)
    } else {
      fadeTimerRef.current = setTimeout(() => setVisible(false), FADE_DELAY_MS)
    }
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [currentDetection, cls])

  // Bbox from current confirmed detection OR live debug frame
  const bbox = currentDetection?.detectionBbox ?? debugPrediction?.detectionBbox ?? null
  const isConfirmed = !!currentDetection && !!cls

  return (
    <>
      {/* ── Bounding box — visual guide only, no COCO label ──────────── */}
      {bbox && (
        <div
          className="absolute pointer-events-none z-10 rounded"
          style={{
            left: `${bbox[0] * 100}%`,
            top: `${bbox[1] * 100}%`,
            width: `${bbox[2] * 100}%`,
            height: `${bbox[3] * 100}%`,
            border: `2px solid ${isConfirmed ? (cls?.color ?? '#22c55e') : 'rgba(234,179,8,0.55)'}`,
          }}
        />
      )}

      {/* ── Confirmed label (custom class only) ────────────────────── */}
      {visible && cls && currentDetection && (
        <div className="absolute top-4 left-4 z-20 animate-fade-in">
          <DetectionLabel
            name={cls.name}
            confidence={currentDetection.confidence}
            color={cls.color}
            showName={cls.showName}
            showConfidence={cls.showConfidence}
          />
        </div>
      )}

      {/* ── Asset layer ──────────────────────────────────────────────── */}
      {visible && cls?.asset && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center animate-fade-in">
          <AssetRenderer asset={cls.asset} active={visible} />
        </div>
      )}
    </>
  )
}
