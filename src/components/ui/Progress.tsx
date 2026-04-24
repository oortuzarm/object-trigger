interface ProgressProps {
  value: number   // 0-100
  color?: string  // tailwind bg class
  size?: 'sm' | 'md'
  showLabel?: boolean
  label?: string
}

export function Progress({ value, color = 'bg-brand-500', size = 'md', showLabel, label }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const heightClass = size === 'sm' ? 'h-1' : 'h-2'

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs font-mono text-gray-400">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className={['w-full bg-gray-800 rounded-full overflow-hidden', heightClass].join(' ')}>
        <div
          className={['rounded-full transition-all duration-300 ease-out', color, heightClass].join(' ')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
