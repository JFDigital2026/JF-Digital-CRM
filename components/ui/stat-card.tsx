'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: { value: number; direction: 'up' | 'down' }
  sparkline?: React.ReactNode
  className?: string
  href?: string
}

export function StatCard({ icon: Icon, label, value, trend, sparkline, className, href }: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(65,90,119,0.10)' }}>
          <Icon size={18} style={{ color: '#415A77' }} />
        </div>
        {trend && (
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: trend.direction === 'up' ? '#27AE60' : '#C0392B' }}
          >
            {trend.direction === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div>
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: '#778DA9', letterSpacing: '0.04em' }}
        >
          {label}
        </p>
        <p className="mt-0.5 font-bold" style={{ fontSize: 28, color: '#0D1B2A', lineHeight: 1.2 }}>
          {value}
        </p>
      </div>
      {sparkline && <div className="mt-1">{sparkline}</div>}
    </>
  )

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.70)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.55)',
    borderRadius: 16,
    boxShadow: '0 1px 2px rgba(13,27,42,0.04), 0 4px 16px rgba(13,27,42,0.06)',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  }

  const accentBar = (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'linear-gradient(90deg, #415A77, #778DA9)',
        borderRadius: '3px 3px 0 0',
      }}
    />
  )

  const cardCls = cn('flex flex-col gap-3 transition-shadow duration-200', href && 'cursor-pointer', className)

  if (href) {
    return (
      <Link href={href} className="block">
        <motion.div
          whileHover={{ boxShadow: '0 2px 4px rgba(13,27,42,0.06), 0 8px 24px rgba(13,27,42,0.10)', y: -1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cardCls}
          style={cardStyle}
        >
          {accentBar}
          {inner}
        </motion.div>
      </Link>
    )
  }

  return (
    <motion.div
      whileHover={{ boxShadow: '0 2px 4px rgba(13,27,42,0.06), 0 8px 24px rgba(13,27,42,0.10)', y: -1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cardCls}
      style={cardStyle}
    >
      {accentBar}
      {inner}
    </motion.div>
  )
}
