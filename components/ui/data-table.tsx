// Animation: list items stagger 30ms, bulk bar slides up when rows selected
'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export interface TableColumn<T = Record<string, unknown>> {
  key: string
  header: string
  render?: (row: T, index: number) => React.ReactNode
  className?: string
  headerClassName?: string
}

export interface BulkAction {
  label: string
  icon?: LucideIcon
  onClick: (selectedIds: string[]) => void
  danger?: boolean
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: TableColumn<T>[]
  data: T[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  page?: number
  pageSize?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  bulkActions?: BulkAction[]
  getRowId?: (row: T) => string
  getRowClassName?: (row: T) => string | undefined
  className?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyTitle = 'No results',
  emptyDescription,
  onRowClick,
  page = 1,
  pageSize = 20,
  totalCount,
  onPageChange,
  bulkActions,
  getRowId = (row) => (row.id as string) ?? String(Math.random()),
  getRowClassName,
  className,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1
  const allIds = data.map(getRowId)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const hasPagination = !!onPageChange && totalCount !== undefined && totalPages > 1

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  const toggleRow = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  if (loading) {
    return (
      <LoadingSkeleton
        variant="table"
        rows={5}
        columns={columns.length + (bulkActions ? 1 : 0)}
        className={className}
      />
    )
  }

  const hasBulkBar = selected.size > 0 && !!bulkActions

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Bulk action bar */}
      <AnimatePresence>
        {hasBulkBar && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex items-center gap-3 rounded-t-lg bg-navy px-4 py-2.5"
          >
            <span className="text-sm font-medium text-white">{selected.size} selected</span>
            <div className="ml-2 flex items-center gap-2">
              {bulkActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    action.onClick(Array.from(selected))
                    setSelected(new Set())
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    action.danger
                      ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  )}
                >
                  {action.icon && <action.icon size={13} />}
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table wrapper */}
      <div
        className={cn(
          'overflow-x-auto',
          hasBulkBar ? 'border-t-0 rounded-b-2xl' : 'rounded-2xl',
          hasPagination && 'rounded-b-none'
        )}
        style={{
          background: 'rgba(255,255,255,0.70)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: hasBulkBar ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.55)',
          borderTop: hasBulkBar ? 'none' : undefined,
          boxShadow: '0 1px 2px rgba(13,27,42,0.04), 0 4px 16px rgba(13,27,42,0.06)',
        }}
      >
        {data.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} className="py-16" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(13,27,42,0.06)', background: 'rgba(13,27,42,0.03)' }}>
                {bulkActions && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn('px-4 py-3 text-left', col.headerClassName)}
                    style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#778DA9' }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const id = getRowId(row)
                const isSelected = selected.has(id)
                return (
                  <motion.tr
                    key={id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.15, ease: 'easeOut' }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('transition-colors last:border-0', onRowClick && 'cursor-pointer', getRowClassName?.(row))}
                    style={{
                      borderBottom: '1px solid rgba(13,27,42,0.04)',
                      height: 52,
                      background: isSelected ? 'rgba(65,90,119,0.08)' : undefined,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(65,90,119,0.04)' }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {bulkActions && (
                      <td
                        className="w-10 px-4 py-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleRow(id)
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(id)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)} style={{ color: '#415A77', fontSize: 14 }}>
                        {col.render ? col.render(row, i) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {hasPagination && (
        <div
          className="flex items-center justify-between rounded-b-2xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.55)', borderTop: '1px solid rgba(13,27,42,0.06)' }}
        >
          <span style={{ fontSize: 12, color: '#778DA9' }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount!)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange!(page - 1)}
              disabled={page <= 1}
              className="flex items-center justify-center rounded-[8px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ width: 30, height: 30, color: '#415A77' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(65,90,119,0.08)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <ChevronLeft size={15} />
            </button>
            <span
              className="flex items-center justify-center rounded-[8px] min-w-[30px] h-[30px] px-2"
              style={{ fontSize: 12, fontWeight: 500, background: '#1B263B', color: '#E0E1DD' }}
            >
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange!(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center justify-center rounded-[8px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ width: 30, height: 30, color: '#415A77' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(65,90,119,0.08)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
