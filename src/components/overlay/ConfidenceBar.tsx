interface ConfidenceBarProps {
  confidence: number
  color: string
}

export default function ConfidenceBar({ confidence, color }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100)
  return (
    <div className="w-24">
      <div className="h-1 bg-black/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
