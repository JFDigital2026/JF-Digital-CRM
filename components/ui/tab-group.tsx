'use client'

import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface Tab {
  key: string
  label: string
  count?: number
}

interface TabGroupProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export function TabGroup({ tabs, active, onChange, className }: TabGroupProps) {
  const layoutId = useRef(`tabs-${Math.random().toString(36).slice(2)}`).current

  return (
    <div
      className={cn('inline-flex items-center p-[3px] rounded-[10px]', className)}
      style={{ background: 'rgba(13,27,42,0.05)' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="relative flex items-center gap-1.5 px-4 outline-none transition-colors duration-150"
            style={{
              height: 32,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? '#1B263B' : '#778DA9',
              zIndex: 1,
            }}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-[8px]"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  boxShadow: '0 1px 4px rgba(13,27,42,0.08)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="relative z-10 rounded-full px-1.5 py-0.5 text-xs font-semibold"
                style={{
                  background: isActive ? '#1B263B' : 'rgba(13,27,42,0.08)',
                  color: isActive ? '#E0E1DD' : '#778DA9',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
