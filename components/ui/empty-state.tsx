import React from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div
        className="mb-4 flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'rgba(65,90,119,0.08)',
        }}
      >
        <Icon size={28} style={{ color: '#778DA9' }} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1B263B' }}>{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs" style={{ fontSize: 14, color: '#778DA9' }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
