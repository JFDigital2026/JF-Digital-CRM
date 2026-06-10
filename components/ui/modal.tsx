'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { backdropEnter, modalEnter } from '@/lib/animations'

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, size = 'md', children, className }: ModalProps) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            variants={modalEnter}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn('relative w-full glass-card-elevated', sizeClasses[size], className)}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-5"
              style={{ borderBottom: '1px solid rgba(13,27,42,0.06)' }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#0D1B2A' }}>{title}</h2>
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

            {/* Content */}
            <div className="p-7">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
