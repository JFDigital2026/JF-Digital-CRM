'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Bell,
  CheckCheck,
  Calendar,
  MessageSquare,
  FileText,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  linkUrl?: string | null
  createdAt: string
}

const PAYMENT_FAILURE_TYPES = ['PAYMENT_FAILED', 'PAYMENT_DECLINED']

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  APPOINTMENT_BOOKED: { icon: Calendar,     bg: 'rgba(65,90,119,0.12)',    color: '#415A77' },
  FORM_SUBMITTED:     { icon: FileText,     bg: 'rgba(155,89,182,0.10)',   color: '#9B59B6' },
  MESSAGE_RECEIVED:   { icon: MessageSquare,bg: 'rgba(52,152,219,0.10)',   color: '#3498DB' },
  TASK_DUE:           { icon: Clock,        bg: 'rgba(230,126,34,0.10)',   color: '#E67E22' },
  PAYMENT_MADE:       { icon: DollarSign,   bg: 'rgba(39,174,96,0.10)',    color: '#27AE60' },
  PAYMENT_FAILED:     { icon: AlertCircle,  bg: 'rgba(192,57,43,0.10)',    color: '#C0392B' },
  PAYMENT_DECLINED:   { icon: AlertCircle,  bg: 'rgba(192,57,43,0.10)',    color: '#C0392B' },
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [markingAll, setMarkingAll] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data: Notification[] = await res.json()
        // Defensive client-side sort: payment failures always first
        const sorted = [
          ...data.filter((n) => PAYMENT_FAILURE_TYPES.includes(n.type)),
          ...data.filter((n) => !PAYMENT_FAILURE_TYPES.includes(n.type) && !n.read),
          ...data.filter((n) => !PAYMENT_FAILURE_TYPES.includes(n.type) && n.read),
        ]
        setNotifications(sorted)
      }
    } catch {}
  }

  useEffect(() => {
    // Skip polling while the tab is hidden; refetch immediately on return
    const tick = () => { if (!document.hidden) fetchNotifications() }
    tick()
    const interval = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch {}
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {}
    setMarkingAll(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center rounded-[10px] transition-colors duration-150"
        style={{ width: 36, height: 36, color: '#415A77' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(13,27,42,0.06)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full border-2 border-white font-bold text-white"
            style={{ width: 16, height: 16, fontSize: 9, background: '#C0392B' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 z-50"
            style={{
              width: 380,
              maxHeight: 480,
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.60)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(13,27,42,0.12), 0 2px 8px rgba(13,27,42,0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(13,27,42,0.06)' }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2A' }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 transition-colors duration-150 disabled:opacity-50"
                  style={{ fontSize: 12, color: '#415A77' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0D1B2A' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#415A77' }}
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Bell size={24} className="mb-2" style={{ color: 'rgba(13,27,42,0.15)' }} />
                  <p style={{ fontSize: 13, color: '#778DA9' }}>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const config = TYPE_CONFIG[notification.type] ?? { icon: AlertCircle, bg: 'rgba(13,27,42,0.06)', color: '#778DA9' }
                  const Icon = config.icon
                  const isPaymentFailure = PAYMENT_FAILURE_TYPES.includes(notification.type)
                  const baseBackground = isPaymentFailure
                    ? 'rgba(192,57,43,0.08)'
                    : notification.read ? 'transparent' : 'rgba(65,90,119,0.04)'
                  const hoverBackground = isPaymentFailure
                    ? 'rgba(192,57,43,0.13)'
                    : 'rgba(65,90,119,0.06)'
                  return (
                    <button
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read) markRead(notification.id)
                        if (notification.linkUrl) {
                          window.location.href = notification.linkUrl
                          setOpen(false)
                        }
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-100"
                      style={{
                        borderBottom: '1px solid rgba(13,27,42,0.05)',
                        background: baseBackground,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBackground }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = baseBackground }}
                    >
                      <div
                        className="mt-0.5 flex shrink-0 items-center justify-center rounded-full"
                        style={{ width: 32, height: 32, background: config.bg }}
                      >
                        <Icon size={13} style={{ color: config.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p
                            className={cn('text-xs font-semibold')}
                            style={{ color: notification.read ? '#778DA9' : '#0D1B2A' }}
                          >
                            {notification.title}
                          </p>
                          {isPaymentFailure && (
                            <span
                              className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{ background: 'rgba(192,57,43,0.12)', color: '#C0392B' }}
                            >
                              DECLINED
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: '#778DA9' }}>
                          {notification.body}
                        </p>
                        <p className="mt-1" style={{ fontSize: 10, color: 'rgba(13,27,42,0.35)' }}>
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div
                          className="mt-1.5 shrink-0 rounded-full"
                          style={{ width: 6, height: 6, background: isPaymentFailure ? '#C0392B' : '#415A77' }}
                        />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
