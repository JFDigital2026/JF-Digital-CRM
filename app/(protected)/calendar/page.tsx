'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays,
  format, isSameDay, isSameMonth, isToday, getHours, getMinutes,
  differenceInMinutes, startOfDay, endOfDay,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Globe, X, Clock, User, ExternalLink,
  CalendarDays, Copy, Check, Settings, Eye, Trash2, Plus,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarView = 'week' | 'month' | 'day'
type ActiveTab = 'calendar' | 'booking'

type CRMEvent = {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  notes?: string | null
  contact?: { id: string; firstName: string; lastName: string } | null
  calendarConfig?: { id: string; name: string; meetingColor?: string | null } | null
}

type GoogleEvent = {
  id: string
  title: string
  start: string
  end: string
  colorId?: string | null
  isAllDay: boolean
  source: 'google'
  htmlLink?: string
}

type DisplayEvent = {
  id: string
  title: string
  start: Date
  end: Date
  source: 'crm' | 'google'
  color: string
  isAllDay?: boolean
  contactName?: string
  htmlLink?: string
  crmId?: string
}

type CalendarConfig = {
  id: string
  name: string
  type: string
  slug: string
  duration: number
  bufferTime: number
  timezone: string
  active: boolean
  createdAt: string
  _count: { events: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986CB',
  '2': '#33B679',
  '3': '#8E24AA',
  '4': '#E67C73',
  '5': '#F6BF26',
  '6': '#F4511E',
  '7': '#039BE5',
  '8': '#616161',
  '9': '#3F51B5',
  '10': '#0B8043',
  '11': '#D50000',
}
const DEFAULT_GOOGLE_COLOR = '#4285F4'
const DEFAULT_CRM_COLOR = '#0D1B2A'

const CALENDAR_TYPES = [
  'Discovery Call',
  'Strategy Call',
  'Closing Call',
  'Implementation Call',
  'Custom',
]

const TYPE_COLOR: Record<string, string> = {
  'Discovery Call': 'bg-blue-100 text-blue-700',
  'Strategy Call': 'bg-purple-100 text-purple-700',
  'Closing Call': 'bg-emerald-100 text-emerald-700',
  'Implementation Call': 'bg-amber-100 text-amber-700',
  'Custom': 'bg-gray-100 text-gray-700',
}

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  const end = endOfWeek(date, { weekStartsOn: 0 })
  return eachDayOfInterval({ start, end })
}

function getMonthWeeks(date: Date): Date[][] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd })
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }
  return weeks
}

function getDateRange(view: CalendarView, date: Date): { from: Date; to: Date } {
  if (view === 'week')
    return {
      from: startOfWeek(date, { weekStartsOn: 0 }),
      to: endOfWeek(date, { weekStartsOn: 0 }),
    }
  if (view === 'month')
    return {
      from: startOfWeek(startOfMonth(date), { weekStartsOn: 0 }),
      to: endOfWeek(endOfMonth(date), { weekStartsOn: 0 }),
    }
  return { from: startOfDay(date), to: endOfDay(date) }
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id?: string
}) {
  return (
    <label
      htmlFor={id}
      className="relative inline-flex h-5 w-9 cursor-pointer items-center"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`absolute inset-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-[#415A77]' : 'bg-gray-200'
        }`}
      />
      <span
        className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </label>
  )
}

// ─── New Calendar Modal ───────────────────────────────────────────────────────

function NewCalendarModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState('Discovery Call')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setType('Discovery Call')
    setError('')
    setLoading(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Calendar name is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setError(msg || 'Failed to create calendar.')
        setLoading(false)
        return
      }
      const created: CalendarConfig = await res.json()
      router.push(`/calendar/${created.id}/settings`)
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Calendar" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Calendar Name <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            placeholder="e.g. 30-Min Discovery Call"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Type</label>
          <select
            className={inputClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {CALENDAR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Calendar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Calendar Card ────────────────────────────────────────────────────────────

function CalendarCard({
  calendar,
  onDelete,
  onToggleActive,
}: {
  calendar: CalendarConfig
  onDelete: (id: string) => void
  onToggleActive: (id: string, active: boolean) => Promise<void>
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [active, setActive] = useState(calendar.active)
  const [toggling, setToggling] = useState(false)

  const bookingUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/book/${calendar.slug}`
      : `/book/${calendar.slug}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing
    }
  }

  const handleToggle = async (val: boolean) => {
    setActive(val)
    setToggling(true)
    try {
      await onToggleActive(calendar.id, val)
    } catch {
      setActive(!val)
    } finally {
      setToggling(false)
    }
  }

  const typeColor = TYPE_COLOR[calendar.type] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-tight">
          {calendar.name}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}
        >
          {calendar.type}
        </span>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {calendar.duration} min
        </span>
        {calendar.bufferTime > 0 && (
          <span className="flex items-center gap-1">
            <CalendarDays size={12} />
            {calendar.bufferTime} min buffer
          </span>
        )}
        <span className="flex items-center gap-1">
          <Globe size={12} />
          {calendar.timezone}
        </span>
      </div>

      {/* Booking link */}
      <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="flex-1 truncate font-mono text-xs text-gray-500">
          /book/{calendar.slug}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-[#415A77] hover:bg-gray-100 transition-colors"
        >
          {copied ? (
            <>
              <Check size={11} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={11} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-2">
        <ToggleSwitch
          id={`active-${calendar.id}`}
          checked={active}
          onChange={handleToggle}
        />
        <label
          htmlFor={`active-${calendar.id}`}
          className={`text-xs font-medium cursor-pointer ${
            toggling ? 'opacity-50' : ''
          } ${active ? 'text-emerald-600' : 'text-gray-400'}`}
        >
          {active ? 'Active' : 'Inactive'}
        </label>
        <span className="ml-auto text-xs text-gray-400">
          {calendar._count.events} bookings
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 border-t border-gray-50 pt-2">
        <button
          onClick={() => router.push(`/calendar/${calendar.id}/settings`)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Settings size={13} />
          Settings
        </button>
        <button
          onClick={() => router.push(`/calendar/${calendar.id}`)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Eye size={13} />
          View
        </button>
        <button
          onClick={() => onDelete(calendar.id)}
          className="ml-auto flex items-center gap-1 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Delete calendar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  weeks,
  events,
  currentDate,
  onDayClick,
  onEventClick,
}: {
  weeks: Date[][]
  events: DisplayEvent[]
  currentDate: Date
  onDayClick: (date: Date) => void
  onEventClick: (event: DisplayEvent) => void
}) {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-gray-200 shrink-0">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-gray-500 uppercase border-r border-gray-200 last:border-0"
          >
            {d}
          </div>
        ))}
      </div>
      {/* Weeks grid */}
      <div className="flex-1 overflow-y-auto">
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-gray-200 last:border-0"
            style={{ minHeight: 120 }}
          >
            {week.map((day) => {
              const allDayEvents = events.filter((e) => isSameDay(e.start, day))
              const visibleEvents = allDayEvents.slice(0, 3)
              const moreCount = allDayEvents.length - 3
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDayClick(day)}
                  className={`border-r border-gray-200 last:border-0 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !isSameMonth(day, currentDate) ? 'bg-gray-50/50' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${
                      isToday(day)
                        ? 'bg-[#0D1B2A] text-white'
                        : !isSameMonth(day, currentDate)
                        ? 'text-gray-300'
                        : 'text-gray-900'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {visibleEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(evt)
                        }}
                        style={{ backgroundColor: evt.color }}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white truncate cursor-pointer hover:opacity-80"
                      >
                        {evt.title}
                      </div>
                    ))}
                    {moreCount > 0 && (
                      <div className="text-[10px] text-gray-500 pl-1">
                        +{moreCount} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar')

  // ── Calendar view state ───────────────────────────────────────────────────
  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [crmEvents, setCrmEvents] = useState<CRMEvent[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(false)

  // ── Create event modal ────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSlotDate, setCreateSlotDate] = useState<Date | null>(null)
  const [createSlotHour, setCreateSlotHour] = useState<number>(9)
  const [calendars, setCalendars] = useState<CalendarConfig[]>([])
  const [createForm, setCreateForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
    calendarId: '',
  })
  const [creatingEvent, setCreatingEvent] = useState(false)

  // ── Event detail ──────────────────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | null>(null)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ── Booking links state ────────────────────────────────────────────────────
  const [bookingCalendars, setBookingCalendars] = useState<CalendarConfig[]>([])
  const [loadingBooking, setLoadingBooking] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timeGridRef = useRef<HTMLDivElement>(null)

  // ── Derived ────────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const monthWeeks = useMemo(() => getMonthWeeks(currentDate), [currentDate])

  // ─── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ─── Navigation ───────────────────────────────────────────────────────────
  function navigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') {
      setCurrentDate(new Date())
      return
    }
    if (view === 'week') {
      setCurrentDate((prev) =>
        direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1)
      )
    } else if (view === 'month') {
      setCurrentDate((prev) =>
        direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1)
      )
    } else {
      setCurrentDate((prev) =>
        direction === 'next' ? addDays(prev, 1) : subDays(prev, 1)
      )
    }
  }

  // ─── Date range label ─────────────────────────────────────────────────────
  function getDateRangeLabel(): string {
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
      }
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    }
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    return format(currentDate, 'EEEE, MMMM d, yyyy')
  }

  // ─── Fetch calendar events ─────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    const { from, to } = getDateRange(view, currentDate)
    const fromStr = from.toISOString()
    const toStr = to.toISOString()

    const [crmRes, googleRes, calendarsRes] = await Promise.all([
      fetch(`/api/calendar/all-events?from=${fromStr}&to=${toStr}`),
      fetch(`/api/user/google/events?from=${fromStr}&to=${toStr}`),
      fetch('/api/calendar'),
    ])

    const crmData = crmRes.ok ? await crmRes.json() : {}
    setCrmEvents(crmData.events ?? [])

    const googleData = googleRes.ok ? await googleRes.json() : {}
    setGoogleEvents(googleData.events ?? [])
    setGoogleConnected(googleData.connected ?? false)
    setGoogleEmail(googleData.email ?? null)

    const calData = calendarsRes.ok ? await calendarsRes.json() : {}
    setCalendars(
      Array.isArray(calData) ? calData : (calData.calendars ?? [])
    )

    setLoadingEvents(false)
  }, [view, currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // ─── Auto-scroll to 8am ────────────────────────────────────────────────────
  useEffect(() => {
    if (timeGridRef.current) {
      timeGridRef.current.scrollTop = 8 * 60
    }
  }, [view])

  // ─── Pre-populate create form when slot selected ───────────────────────────
  useEffect(() => {
    if (createSlotDate && createSlotHour !== null) {
      setCreateForm((f) => ({
        ...f,
        date: format(createSlotDate, 'yyyy-MM-dd'),
        time: `${String(createSlotHour).padStart(2, '0')}:00`,
      }))
    }
  }, [createSlotDate, createSlotHour])

  // ─── Handle google query params ────────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      showToast('Google Calendar connected!')
      window.history.replaceState({}, '', '/calendar')
    }
    if (searchParams.get('google') === 'error') {
      showToast('Google Calendar connection failed', 'error')
      window.history.replaceState({}, '', '/calendar')
    }
  }, [searchParams, showToast])

  // ─── Unified display events ────────────────────────────────────────────────
  const displayEvents = useMemo((): DisplayEvent[] => {
    const crm: DisplayEvent[] = crmEvents.map((e) => ({
      id: e.id,
      title: e.title,
      start: new Date(e.startTime),
      end: new Date(e.endTime),
      source: 'crm' as const,
      color: e.calendarConfig?.meetingColor ?? DEFAULT_CRM_COLOR,
      contactName: e.contact
        ? `${e.contact.firstName} ${e.contact.lastName}`
        : undefined,
      crmId: e.id,
    }))
    const google: DisplayEvent[] = googleEvents.map((e) => ({
      id: e.id,
      title: e.title,
      start: new Date(e.start),
      end: new Date(e.end),
      source: 'google' as const,
      color: e.colorId
        ? (GOOGLE_COLORS[e.colorId] ?? DEFAULT_GOOGLE_COLOR)
        : DEFAULT_GOOGLE_COLOR,
      isAllDay: e.isAllDay,
      htmlLink: e.htmlLink,
    }))
    return [...crm, ...google]
  }, [crmEvents, googleEvents])

  // ─── Create CRM event ──────────────────────────────────────────────────────
  const handleCreateCRMEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.calendarId) {
      showToast('Select a calendar', 'error')
      return
    }
    setCreatingEvent(true)
    const startTime = new Date(`${createForm.date}T${createForm.time}`)
    const endTime = new Date(
      startTime.getTime() + parseInt(createForm.duration) * 60000
    )
    const res = await fetch(
      `/api/calendar/${createForm.calendarId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      }
    )
    setCreatingEvent(false)
    if (res.ok) {
      setShowCreateModal(false)
      setCreateForm({
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration: '60',
        calendarId: '',
      })
      fetchEvents()
      showToast('Event created')
    } else {
      showToast('Failed to create event', 'error')
    }
  }

  // ─── Booking links handlers ────────────────────────────────────────────────
  const fetchBookingCalendars = useCallback(async () => {
    setLoadingBooking(true)
    try {
      const res = await fetch('/api/calendar')
      if (res.ok) {
        const data = await res.json()
        setBookingCalendars(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoadingBooking(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'booking') {
      fetchBookingCalendars()
    }
  }, [activeTab, fetchBookingCalendars])

  const handleToggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/calendar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await fetch(`/api/calendar/${deleteId}`, { method: 'DELETE' })
      setDeleteId(null)
      fetchBookingCalendars()
    } finally {
      setDeleting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab selector */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'calendar'
              ? 'bg-[#0D1B2A] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('booking')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'booking'
              ? 'bg-[#0D1B2A] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Booking Links
        </button>
      </div>

      {/* ── CALENDAR TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div
          style={{ height: 'calc(100vh - 108px - 48px)' }}
          className="flex flex-col overflow-hidden bg-white rounded-xl border border-gray-200"
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('prev')}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              <button
                onClick={() => navigate('today')}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Today
              </button>
              <button
                onClick={() => navigate('next')}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
              >
                <ChevronRight size={16} className="text-gray-600" />
              </button>
              <h2 className="text-base font-semibold text-gray-900 ml-2">
                {getDateRangeLabel()}
              </h2>
              {loadingEvents && (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin ml-1" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Google connect/disconnect */}
              {!googleConnected ? (
                <a
                  href="/api/user/google/connect"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Globe size={13} className="text-blue-500" />
                  Connect Google Calendar
                </a>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-2.5 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-green-700 font-medium">
                    {googleEmail ?? 'Google Connected'}
                  </span>
                  <button
                    onClick={async () => {
                      await fetch('/api/user/google/disconnect', {
                        method: 'POST',
                      })
                      setGoogleConnected(false)
                      setGoogleEmail(null)
                      fetchEvents()
                    }}
                    className="ml-1 text-green-600 hover:text-red-500 transition-colors text-xs"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* New event button */}
              <button
                onClick={() => {
                  setCreateSlotDate(new Date())
                  setCreateSlotHour(9)
                  setShowCreateModal(true)
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B263B] transition-colors"
              >
                <Plus size={13} />
                New Event
              </button>

              {/* View toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['day', 'week', 'month'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                      view === v
                        ? 'bg-[#0D1B2A] text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── WEEK VIEW ──────────────────────────────────────────────────────── */}
          {view === 'week' && (
            <>
              {/* Day headers */}
              <div
                className="grid shrink-0 border-b border-gray-200"
                style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
              >
                <div className="border-r border-gray-200 py-2" />
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`py-2 text-center border-r border-gray-200 last:border-0 ${
                      isToday(day) ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                      {format(day, 'EEE')}
                    </div>
                    <div
                      className={`mt-1 mx-auto h-8 w-8 flex items-center justify-center rounded-full text-sm font-semibold ${
                        isToday(day)
                          ? 'bg-[#0D1B2A] text-white'
                          : 'text-gray-900'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div
                ref={timeGridRef}
                className="flex-1 overflow-y-auto min-h-0"
              >
                <div
                  className="relative"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '64px repeat(7, 1fr)',
                    height: 1440,
                  }}
                >
                  {/* Time labels */}
                  <div className="border-r border-gray-200 col-span-1">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        style={{ height: 60 }}
                        className="border-b border-gray-100 relative"
                      >
                        {h > 0 && (
                          <span className="absolute -top-2.5 right-2 text-[10px] text-gray-400">
                            {format(new Date(2024, 0, 1, h), 'h a')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day) => {
                    const dayEvents = displayEvents.filter(
                      (e) => !e.isAllDay && isSameDay(e.start, day)
                    )
                    return (
                      <div
                        key={day.toISOString()}
                        className="border-r border-gray-200 last:border-0 relative"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <div
                            key={h}
                            style={{ height: 60 }}
                            className="border-b border-gray-100 hover:bg-blue-50/20 cursor-pointer transition-colors"
                            onClick={() => {
                              setCreateSlotDate(day)
                              setCreateSlotHour(h)
                              setShowCreateModal(true)
                            }}
                          />
                        ))}
                        {dayEvents.map((event) => {
                          const startMins =
                            getHours(event.start) * 60 +
                            getMinutes(event.start)
                          const endMins =
                            getHours(event.end) * 60 + getMinutes(event.end)
                          const height = Math.max(endMins - startMins, 30)
                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(event)
                              }}
                              style={{
                                position: 'absolute',
                                top: startMins,
                                height,
                                left: 2,
                                right: 2,
                                backgroundColor: event.color,
                                zIndex: 10,
                              }}
                              className="rounded-md px-1.5 py-1 cursor-pointer hover:opacity-90 overflow-hidden"
                            >
                              <p className="text-[11px] font-semibold text-white leading-tight truncate">
                                {event.title}
                              </p>
                              {height >= 45 && (
                                <p className="text-[10px] text-white/75 leading-tight">
                                  {format(event.start, 'h:mm a')}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {/* Current time line */}
                  {(() => {
                    if (!weekDays.some((d) => isToday(d))) return null
                    const now = new Date()
                    const top =
                      getHours(now) * 60 + getMinutes(now)
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top,
                          left: 64,
                          right: 0,
                          zIndex: 20,
                          pointerEvents: 'none',
                        }}
                        className="flex items-center"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                        <div className="flex-1 h-0.5 bg-red-500" />
                      </div>
                    )
                  })()}
                </div>
              </div>
            </>
          )}

          {/* ── MONTH VIEW ─────────────────────────────────────────────────────── */}
          {view === 'month' && (
            <MonthView
              weeks={monthWeeks}
              events={displayEvents}
              currentDate={currentDate}
              onDayClick={(d) => {
                setCurrentDate(d)
                setView('day')
              }}
              onEventClick={(e) => setSelectedEvent(e)}
            />
          )}

          {/* ── DAY VIEW ───────────────────────────────────────────────────────── */}
          {view === 'day' && (
            <>
              {/* Day header */}
              <div className="flex items-center justify-center py-3 border-b border-gray-200 shrink-0">
                <div
                  className={`h-10 w-10 flex items-center justify-center rounded-full text-lg font-bold ${
                    isToday(currentDate)
                      ? 'bg-[#0D1B2A] text-white'
                      : 'text-gray-900'
                  }`}
                >
                  {format(currentDate, 'd')}
                </div>
                <div className="ml-3">
                  <p className="font-semibold text-gray-900">
                    {format(currentDate, 'EEEE')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(currentDate, 'MMMM yyyy')}
                  </p>
                </div>
              </div>

              {/* Time grid */}
              <div
                ref={timeGridRef}
                className="flex-1 overflow-y-auto min-h-0"
              >
                <div className="relative flex" style={{ height: 1440 }}>
                  {/* Time labels */}
                  <div className="w-16 shrink-0 border-r border-gray-200">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        style={{ height: 60 }}
                        className="border-b border-gray-100 relative"
                      >
                        {h > 0 && (
                          <span className="absolute -top-2.5 right-2 text-[10px] text-gray-400">
                            {format(new Date(2024, 0, 1, h), 'h a')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Events column */}
                  <div className="flex-1 relative">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        style={{ height: 60 }}
                        className="border-b border-gray-100 hover:bg-blue-50/20 cursor-pointer"
                        onClick={() => {
                          setCreateSlotDate(currentDate)
                          setCreateSlotHour(h)
                          setShowCreateModal(true)
                        }}
                      />
                    ))}
                    {displayEvents
                      .filter(
                        (e) =>
                          !e.isAllDay && isSameDay(e.start, currentDate)
                      )
                      .map((event) => {
                        const startMins =
                          getHours(event.start) * 60 +
                          getMinutes(event.start)
                        const height = Math.max(
                          differenceInMinutes(event.end, event.start),
                          30
                        )
                        return (
                          <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            style={{
                              position: 'absolute',
                              top: startMins,
                              height,
                              left: 4,
                              right: 4,
                              backgroundColor: event.color,
                            }}
                            className="rounded-lg px-3 py-2 cursor-pointer hover:opacity-90 z-10"
                          >
                            <p className="text-sm font-semibold text-white">
                              {event.title}
                            </p>
                            {height >= 45 && (
                              <p className="text-xs text-white/80">
                                {format(event.start, 'h:mm a')} &ndash;{' '}
                                {format(event.end, 'h:mm a')}
                              </p>
                            )}
                          </div>
                        )
                      })}

                    {/* Current time line */}
                    {isToday(currentDate) &&
                      (() => {
                        const now = new Date()
                        const top =
                          getHours(now) * 60 + getMinutes(now)
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              top,
                              left: 0,
                              right: 0,
                              zIndex: 20,
                              pointerEvents: 'none',
                            }}
                            className="flex items-center"
                          >
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                            <div className="flex-1 h-0.5 bg-red-500" />
                          </div>
                        )
                      })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BOOKING LINKS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'booking' && (
        <div>
          <PageHeader
            title="Booking Links"
            subtitle="Manage your booking calendars and availability"
            actions={
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors"
              >
                <Plus size={15} />
                New Calendar
              </button>
            }
          />

          {loadingBooking ? (
            <LoadingSkeleton variant="card" count={3} />
          ) : bookingCalendars.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No calendars yet"
              description="Create a booking calendar to start accepting appointments."
              action={
                <button
                  onClick={() => setShowNewModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors"
                >
                  <Plus size={15} />
                  New Calendar
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookingCalendars.map((cal) => (
                <CalendarCard
                  key={cal.id}
                  calendar={cal}
                  onDelete={(id) => setDeleteId(id)}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EVENT DETAIL POPOVER ───────────────────────────────────────────────── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: selectedEvent.color }}
                />
                <h3 className="font-semibold text-gray-900 text-sm">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-gray-400" />
                {selectedEvent.isAllDay
                  ? 'All day'
                  : `${format(selectedEvent.start, 'h:mm a')} – ${format(
                      selectedEvent.end,
                      'h:mm a'
                    )}`}
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays size={12} className="text-gray-400" />
                {format(selectedEvent.start, 'EEEE, MMMM d, yyyy')}
              </div>
              {selectedEvent.contactName && (
                <div className="flex items-center gap-2">
                  <User size={12} className="text-gray-400" />
                  {selectedEvent.contactName}
                </div>
              )}
              {selectedEvent.source === 'google' && (
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-gray-400" />
                  <span className="text-blue-600">Google Calendar</span>
                </div>
              )}
            </div>
            {selectedEvent.htmlLink && (
              <a
                href={selectedEvent.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                Open in Google Calendar <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE EVENT MODAL ────────────────────────────────────────────────── */}
      {showCreateModal && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="New Event"
          size="sm"
        >
          <form onSubmit={handleCreateCRMEvent} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Title *
              </label>
              <input
                required
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
                className={inputClass}
                placeholder="Event title"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Date
                </label>
                <input
                  type="date"
                  value={createForm.date}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Time
                </label>
                <input
                  type="time"
                  value={createForm.time}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, time: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Duration (minutes)
              </label>
              <select
                value={createForm.duration}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, duration: e.target.value }))
                }
                className={inputClass}
              >
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            {calendars.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Calendar
                </label>
                <select
                  value={createForm.calendarId}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      calendarId: e.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Select calendar</option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingEvent}
                className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
              >
                {creatingEvent ? 'Creating…' : 'Create Event'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── NEW CALENDAR MODAL (booking tab) ──────────────────────────────────── */}
      <NewCalendarModal
        open={showNewModal}
        onClose={() => {
          setShowNewModal(false)
          fetchBookingCalendars()
        }}
      />

      {/* ── DELETE CONFIRM ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Calendar"
        description="This will permanently delete the calendar and all associated bookings. This cannot be undone."
        destructive
        loading={deleting}
      />

      {/* ── TOAST ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-[#0D1B2A]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
