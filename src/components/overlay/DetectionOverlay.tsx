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

  // Bounding box — show whenever COCO-SSD has a detection (even before confirmation)
  const bbox = currentDetection?.detectionBbox ?? debugPrediction?.detectionBbox ?? null
  const isConfirmed = !!currentDetection && !!cls

  return (
    <>
      {/* ── COCO-SSD bounding box ────────────────────────────────────── */}
      {bbox && (
        <div
          className="absolute pointer-events-none z-10 rounded"
          style={{
            left: `${bbox[0] * 100}%`,
            top: `${bbox[1] * 100}%`,
            width: `${bbox[2] * 100}%`,
            height: `${bbox[3] * 100}%`,
            border: `2px solid ${isConfirmed ? (cls?.color ?? '#22c55e') : 'rgba(234,179,8,0.7)'}`,
            boxShadow: isConfirmed
              ? `0 0 0 1px ${cls?.color ?? '#22c55e'}33`
              : '0 0 0 1px rgba(234,179,8,0.2)',
          }}
        >
          {/* Score badge on bbox corner */}
          <span
            className="absolute -top-5 left-0 text-[10px] font-mono px-1 rounded-sm leading-4"
            style={{
              backgroundColor: isConfirmed ? (cls?.color ?? '#22c55e') + 'cc' : 'rgba(234,179,8,0.75)',
              color: '#000',
            }}
          >
            {debugPrediction?.detectionLabel ?? currentDetection?.detectionLabel ?? ''}
            {' '}
            {Math.round((debugPrediction?.detectionScore ?? currentDetection?.detectionScore ?? 0) * 100)}%
          </span>
        </div>
      )}

      {/* ── Confirmed label — top-left of the camera container ──────── */}
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
