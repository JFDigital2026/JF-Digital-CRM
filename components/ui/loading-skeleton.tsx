import React from 'react'
import { cn } from '@/lib/utils'

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg', className)} />
}

function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl"
      style={{ border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.70)' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(13,27,42,0.06)', background: 'rgba(13,27,42,0.03)' }}>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <SkeletonBlock className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} style={{ borderBottom: '1px solid rgba(13,27,42,0.04)' }}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonBlock className={cn('h-3', c === 0 ? 'w-32' : 'w-24')} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{
            background: 'rgba(255,255,255,0.70)',
            border: '1px solid rgba(255,255,255,0.55)',
            boxShadow: '0 1px 2px rgba(13,27,42,0.04), 0 4px 16px rgba(13,27,42,0.06)',
          }}
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
            <SkeletonBlock className="h-4 w-12" />
          </div>
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-7 w-24" />
        </div>
      ))}
    </div>
  )
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: 'rgba(255,255,255,0.70)',
            border: '1px solid rgba(255,255,255,0.55)',
          }}
        >
          <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1">
            <SkeletonBlock className="mb-1.5 h-3 w-40" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <SkeletonBlock className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

interface LoadingSkeletonProps {
  variant: 'table' | 'card' | 'list'
  rows?: number
  columns?: number
  count?: number
  className?: string
}

export function LoadingSkeleton({ variant, rows, columns, count, className }: LoadingSkeletonProps) {
  return (
    <div className={cn(className)}>
      {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
      {variant === 'card' && <CardSkeleton count={count} />}
      {variant === 'list' && <ListSkeleton rows={rows} />}
    </div>
  )
}
