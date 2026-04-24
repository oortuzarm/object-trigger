import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import DetectionLabel from './DetectionLabel'
import AssetRenderer from '@/components/assets/AssetRenderer'

const FADE_DELAY_MS = 1500

export default function DetectionOverlay() {
  const { inferenceState, classes } = useAppStore()
  const { currentDetection } = inferenceState
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

  if (!visible || !cls || !currentDetection) return null

  return (
    <>
      {/* Label — top-left of the camera container */}
      <div className="absolute top-4 left-4 z-20 animate-fade-in">
        <DetectionLabel
          name={cls.name}
          confidence={currentDetection.confidence}
          color={cls.color}
          showName={cls.showName}
          showConfidence={cls.showConfidence}
        />
      </div>

      {/* Asset layer */}
      {cls.asset && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center animate-fade-in">
          <AssetRenderer asset={cls.asset} active={visible} />
        </div>
      )}
    </>
  )
}
