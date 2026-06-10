'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { backdropEnter, slideOverEnter } from '@/lib/animations'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  width?: number | string
  headerAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SlideOver({
  open,
  onClose,
  title,
  width = 420,
  headerAction,
  children,
  className,
}: SlideOverProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            variants={backdropEnter}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
            style={{ background: 'rgba(13,27,42,0.40)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            variants={slideOverEnter}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              width,
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.50)',
              boxShadow: '-8px 0 32px rgba(13,27,42,0.12)',
            }}
            className={cn('relative flex h-full flex-col', className)}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: '1px solid rgba(13,27,42,0.06)' }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#0D1B2A' }}>{title}</h2>
              <div className="flex items-center gap-2">
                {headerAction}
                <button
                  onClick={onClose}
                  className="flex items-center justify-center rounded-[8px] transition-colors duration-150"
                  style={{ width: 28, height: 28, color: '#778DA9' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(13,27,42,0.06)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
