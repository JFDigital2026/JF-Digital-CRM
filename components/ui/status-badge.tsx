import React from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple'

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  success: { background: '#E6F4EA', color: '#1B5E20', border: '1px solid rgba(39,174,96,0.20)' },
  warning: { background: '#FFF8E1', color: '#E65100', border: '1px solid rgba(230,126,34,0.20)' },
  error:   { background: '#FDECEA', color: '#B71C1C', border: '1px solid rgba(192,57,43,0.20)' },
  info:    { background: '#E8F0FE', color: '#1B263B', border: '1px solid rgba(65,90,119,0.20)' },
  neutral: { background: '#E0E1DD', color: '#415A77', border: '1px solid rgba(65,90,119,0.15)' },
  purple:  { background: '#EDE7F6', color: '#4A148C', border: '1px solid rgba(155,89,182,0.20)' },
}

const dotColors: Record<BadgeVariant, string> = {
  success: '#27AE60',
  warning: '#E67E22',
  error:   '#C0392B',
  info:    '#415A77',
  neutral: '#778DA9',
  purple:  '#9B59B6',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label: string
  dot?: boolean
  className?: string
}

export function StatusBadge({ variant, label, dot, className }: StatusBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full', className)}
      style={{
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.02em',
        ...variantStyles[variant],
      }}
    >
      {dot && (
        <span
          className="rounded-full"
          style={{ width: 6, height: 6, background: dotColors[variant], display: 'inline-block', flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  )
}
