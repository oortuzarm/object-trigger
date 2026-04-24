import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-brand-600/20 text-brand-400 border-brand-600/30',
  success: 'bg-green-600/20 text-green-400 border-green-600/30',
  warning: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  danger: 'bg-red-600/20 text-red-400 border-red-600/30',
  info: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  neutral: 'bg-gray-700/50 text-gray-400 border-gray-700',
}

const dotClasses: Record<BadgeVariant, string> = {
  default: 'bg-brand-400',
  success: 'bg-green-400',
  warning: 'bg-yellow-400',
  danger: 'bg-red-400',
  info: 'bg-cyan-400',
  neutral: 'bg-gray-400',
}

export function Badge({ variant = 'default', dot, className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {dot && <span className={['w-1.5 h-1.5 rounded-full', dotClasses[variant]].join(' ')} />}
      {children}
    </span>
  )
}
