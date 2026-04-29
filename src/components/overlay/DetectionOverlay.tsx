import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import DetectionLabel from './DetectionLabel'
import AssetRenderer from '@/components/assets/AssetRenderer'

const FADE_DELAY_MS = 1500

interface DetectionOverlayProps {
  /** Video element ref — required for correct bbox coordinate mapping.
   *  Without it, bboxes fall back to raw percentage (may be misaligned). */
  videoRef: React.RefObject<HTMLVideoElement>
}

/**
 * Maps a normalized bbox [x, y, w, h] from the inference engine's coordinate
 * space to CSS pixel positions within the camera container.
 *
 * The inference engine captures a CENTER-SQUARE crop of the video frame:
 *   size = min(videoWidth, videoHeight)
 *   crop starts at ((videoWidth - size) / 2, (videoHeight - size) / 2)
 *
 * The <video> element uses object-cover, which scales the video so its
 * largest dimension fills the container, centering and clipping the rest.
 *
 * This function computes where the inference square lands on screen after
 * object-cover scaling, then maps the normalized bbox into that region.
 */
function mapBbox(
  norm: [number, number, number, number],
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): React.CSSProperties {
  if (!containerW || !containerH || !videoW || !videoH) {
    // Dimensions not available yet — return a safe no-op that won't show
    return { display: 'none' }
  }

  // object-cover: scale the video so it completely covers the container.
  // The larger scale factor (by width or by height) is used.
  const scale = Math.max(containerW / videoW, containerH / videoH)

  // The inference engine crops the center square of the native video frame.
  const sqSizePx = Math.min(videoW, videoH) * scale   // rendered size of that square (CSS px)

  // The inference square is centered on the container (same center as object-cover).
  const sqLeft = (containerW - sqSizePx) / 2
  const sqTop  = (containerH - sqSizePx) / 2

  return {
    left:   sqLeft + norm[0] * sqSizePx,
    top:    sqTop  + norm[1] * sqSizePx,
    width:  norm[2] * sqSizePx,
    height: norm[3] * sqSizePx,
  }
}

export default function DetectionOverlay({ videoRef }: DetectionOverlayProps) {
  const { inferenceState, classes } = useAppStore()
  const { currentDetection, debugPrediction } = inferenceState
  const [visible, setVisible] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const cls = classes.find((c) => c.id === currentDetection?.classId)

  // Track container dimensions via ResizeObserver so bboxes stay correct
  // when the layout changes (sidebar collapse, window resize, orientation change).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  // Video natural dimensions — available once the camera is running.
  // Reading directly from the ref at render time is safe: the overlay is only
  // mounted when isRunning=true, which requires isReady=true (loadeddata fired).
  const videoW = videoRef.current?.videoWidth ?? 0
  const videoH = videoRef.current?.videoHeight ?? 0

  const bbox = currentDetection?.detectionBbox ?? debugPrediction?.detectionBbox ?? null
  const isConfirmed = !!currentDetection && !!cls
  const secondaryCandidates = (debugPrediction?.candidates ?? []).filter((c) => !c.isLocked)

  return (
    // Covers the camera container exactly. overflow:hidden on CameraView clips any edge overflow.
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-10">

      {/* ── Secondary candidate bboxes (dimmed, dashed) ─────────────────────── */}
      {secondaryCandidates.map((c, i) => (
        <div
          key={i}
          className="absolute rounded"
          style={{
            ...mapBbox(c.normBbox, containerSize.w, containerSize.h, videoW, videoH),
            border: '1px dashed rgba(156,163,175,0.35)',
          }}
        />
      ))}

      {/* ── Primary bbox — visual guide, no COCO label ───────────────────────── */}
      {bbox && (
        <div
          className="absolute rounded z-10"
          style={{
            ...mapBbox(bbox, containerSize.w, containerSize.h, videoW, videoH),
            border: `2px solid ${isConfirmed ? (cls?.color ?? '#22c55e') : 'rgba(234,179,8,0.55)'}`,
          }}
        />
      )}

      {/* ── Confirmed label (top-left of camera view) ────────────────────────── */}
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

      {/* ── Asset layer (centered within camera view) ────────────────────────── */}
      {visible && cls?.asset && (
        <div className="absolute inset-0 z-10 flex items-center justify-center animate-fade-in">
          <AssetRenderer asset={cls.asset} active={visible} />
        </div>
      )}

    </div>
  )
}
