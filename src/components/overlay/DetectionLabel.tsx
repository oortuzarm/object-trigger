interface DetectionLabelProps {
  name: string
  confidence: number
  color: string
  showName: boolean
  showConfidence: boolean
}

export default function DetectionLabel({
  name,
  confidence,
  color,
  showName,
  showConfidence,
}: DetectionLabelProps) {
  if (!showName && !showConfidence) return null

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-md border shadow-lg"
      style={{
        backgroundColor: color + '22',
        borderColor: color + '55',
      }}
    >
      {/* Color dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {showName && (
        <span className="text-sm font-semibold text-white drop-shadow-sm">{name}</span>
      )}

      {showConfidence && (
        <span
          className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: color + '44', color: 'white' }}
        >
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  )
}
