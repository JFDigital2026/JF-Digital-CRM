'use client'

import React, { useState } from 'react'
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'

export type CheckboxFilterValue = string[]
export type DateRangeFilterValue = { from?: string; to?: string }
export type NumberRangeFilterValue = { min?: number; max?: number }
export type FilterValue = CheckboxFilterValue | DateRangeFilterValue | NumberRangeFilterValue

export interface CheckboxSection {
  key: string
  label: string
  type: 'checkbox'
  options: Array<{ label: string; value: string }>
}

export interface DateRangeSection {
  key: string
  label: string
  type: 'date-range'
}

export interface NumberRangeSection {
  key: string
  label: string
  type: 'number-range'
  min?: number
  max?: number
  step?: number
}

export type FilterSectionConfig = CheckboxSection | DateRangeSection | NumberRangeSection

interface FilterSidebarProps {
  sections: FilterSectionConfig[]
  value: Record<string, FilterValue>
  onChange: (key: string, value: FilterValue) => void
  onClearAll?: () => void
  className?: string
}

export function FilterSidebar({
  sections,
  value,
  onChange,
  onClearAll,
  className,
}: FilterSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleSection = (key: string) => {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
  }

  const activeCount = Object.values(value).filter((v) => {
    if (Array.isArray(v)) return v.length > 0
    return Object.values(v as object).some(Boolean)
  }).length

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 8,
    border: '1px solid rgba(65,90,119,0.20)',
    padding: '6px 10px',
    fontSize: 12,
    color: '#1B263B',
    background: 'rgba(255,255,255,0.75)',
    outline: 'none',
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} style={{ color: '#778DA9' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#415A77' }}>Filters</span>
          {activeCount > 0 && (
            <span
              className="flex items-center justify-center rounded-full font-bold text-white"
              style={{ width: 16, height: 16, fontSize: 10, background: '#1B263B' }}
            >
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && onClearAll && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 transition-colors duration-150"
            style={{ fontSize: 12, color: '#778DA9' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#C0392B' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#778DA9' }}
          >
            <X size={12} />
            Clear all
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-1.5">
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.key)
          const sectionValue = value[section.key]

          return (
            <div
              key={section.key}
              className="overflow-hidden rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.70)',
                border: '1px solid rgba(255,255,255,0.55)',
                boxShadow: '0 1px 2px rgba(13,27,42,0.04)',
              }}
            >
              <button
                onClick={() => toggleSection(section.key)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#778DA9',
                  }}
                >
                  {section.label}
                </span>
                <motion.div
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronDown size={13} style={{ color: 'rgba(13,27,42,0.25)' }} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <div
                      className="px-3 pb-3 pt-2"
                      style={{ borderTop: '1px solid rgba(13,27,42,0.06)' }}
                    >
                      {section.type === 'checkbox' && (
                        <div className="flex flex-col gap-2">
                          {section.options.map((opt) => {
                            const checked =
                              Array.isArray(sectionValue) && sectionValue.includes(opt.value)
                            return (
                              <label
                                key={opt.value}
                                className="flex cursor-pointer items-center gap-2"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const current = Array.isArray(sectionValue) ? sectionValue : []
                                    onChange(
                                      section.key,
                                      c
                                        ? [...current, opt.value]
                                        : current.filter((v) => v !== opt.value)
                                    )
                                  }}
                                />
                                <span style={{ fontSize: 13, color: '#415A77' }}>{opt.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}

                      {section.type === 'date-range' && (
                        <div className="flex flex-col gap-2">
                          {(['from', 'to'] as const).map((field) => (
                            <input
                              key={field}
                              type="date"
                              value={(sectionValue as DateRangeFilterValue)?.[field] ?? ''}
                              onChange={(e) =>
                                onChange(section.key, {
                                  ...(sectionValue as DateRangeFilterValue),
                                  [field]: e.target.value || undefined,
                                })
                              }
                              placeholder={field === 'from' ? 'From' : 'To'}
                              style={inputStyle}
                            />
                          ))}
                        </div>
                      )}

                      {section.type === 'number-range' && (
                        <div className="flex items-center gap-2">
                          {(['min', 'max'] as const).map((field) => (
                            <input
                              key={field}
                              type="number"
                              min={section.min}
                              max={section.max}
                              step={(section as NumberRangeSection).step ?? 1}
                              value={(sectionValue as NumberRangeFilterValue)?.[field] ?? ''}
                              onChange={(e) =>
                                onChange(section.key, {
                                  ...(sectionValue as NumberRangeFilterValue),
                                  [field]: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                              placeholder={field === 'min' ? 'Min' : 'Max'}
                              style={inputStyle}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
