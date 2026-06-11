'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ExternalLink,
} from 'lucide-react'
import {
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  getWeeksInMonth,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  differenceInMinutes,
  getHours,
  getMinutes,
} from 'date-fns'
import { Modal } from '@/components/ui/modal'
import { SlideOver } from '@/components/ui/slide-over'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarConfig = {
  id: string
  name: string
  type: string
  slug: string
  duration: number
  timezone: string
  active: boolean
}

type CalendarEvent = {
  id: string
  title: string
  startTime: string // ISO string
  endTime: string // ISO string
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  notes?: string | null
  contact?: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
  } | null
}

type ViewMode = 'month' | 'week' | 'day'

type ContactOption = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 48 // px per 30-min slot
const START_HOUR = 6 // 6am = offset 0
const END_HOUR = 22 // 10pm
const TOTAL_HOURS = END_HOUR - START_HOUR // 16
const TOTAL_SLOTS = TOTAL_HOURS * 2 // 32 slots

const STATUS_COLOR: Record<CalendarEvent['status'], string> = {
  CONFIRMED: 'bg-blue-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-gray-400',
  NO_SHOW: 'bg-red-500',
}

const STATUS_BORDER: Record<CalendarEvent['status'], string> = {
  CONFIRMED: 'border-blue-600',
  COMPLETED: 'border-emerald-600',
  CANCELLED: 'border-gray-500',
  NO_SHOW: 'border-red-600',
}

const STATUS_LABEL: Record<CalendarEvent['status'], string> = {
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
}

const ALL_STATUSES: CalendarEvent['status'][] = [
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

// ─── Grid helpers ─────────────────────────────────────────────────────────────

function computeTop(startTime: string): number {
  const d = parseISO(startTime)
  const h = getHours(d)
  const m = getMinutes(d)
  return ((h - START_HOUR) * 60 + m) / 30 * SLOT_HEIGHT
}

function computeHeight(event: CalendarEvent): number {
  const start = parseISO(event.startTime)
  const end = parseISO(event.endTime)
  const mins = Math.max(differenceInMinutes(end, start), 15)
  return Math.max(mins / 30 * SLOT_HEIGHT, 24)
}

function snapToTime(offsetY: number): Date {
  // Each slot is 30 min = SLOT_HEIGHT px
  const slotIndex = Math.floor(offsetY / SLOT_HEIGHT)
  const clamped = Math.max(0, Math.min(slotIndex, TOTAL_SLOTS - 1))
  const totalMins = START_HOUR * 60 + clamped * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

function formatTimeRange(startIso: string, endIso: string): string {
  const s = parseISO(startIso)
  const e = parseISO(endIso)
  return `${format(s, 'EEE MMM d · h:mm a')} – ${format(e, 'h:mm a')}`
}

function toLocalISO(d: Date): string {
  // Returns YYYY-MM-DDTHH:mm:ss without timezone offset, suitable for API
  return format(d, "yyyy-MM-dd'T'HH:mm:ss")
}

// ─── Hour labels ──────────────────────────────────────────────────────────────

const HOUR_LABELS: string[] = Array.from({ length: TOTAL_HOURS }, (_, i) => {
  const h = START_HOUR + i
  return h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
})

// ─── Event chip for month view ────────────────────────────────────────────────

function MonthEventChip({
  event,
  onClick,
}: {
  event: CalendarEvent
  onClick: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium text-white transition-opacity hover:opacity-80 ${STATUS_COLOR[event.status]}`}
    >
      <span className="truncate">{event.title}</span>
    </button>
  )
}

// ─── Week / Day column ────────────────────────────────────────────────────────

function TimeColumn() {
  return (
    <div className="w-14 shrink-0 border-r border-gray-100 select-none">
      {/* offset spacer for header row */}
      <div className="h-10" />
      <div style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }} className="relative">
        {HOUR_LABELS.map((label, i) => (
          <div
            key={label}
            className="absolute right-2 text-[10px] text-gray-400 leading-none"
            style={{ top: i * SLOT_HEIGHT * 2 - 6 }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

interface DayColumnProps {
  day: Date
  events: CalendarEvent[]
  onClickSlot: (time: Date) => void
  onClickEvent: (event: CalendarEvent) => void
}

function DayColumn({ day, events, onClickSlot, onClickEvent }: DayColumnProps) {
  const colRef = useRef<HTMLDivElement>(null)
  const gridHeight = TOTAL_SLOTS * SLOT_HEIGHT

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!colRef.current) return
    const rect = colRef.current.getBoundingClientRect()
    // subtract the header height (40px)
    const offsetY = e.clientY - rect.top
    const time = snapToTime(offsetY)
    const clicked = new Date(day)
    clicked.setHours(time.getHours(), time.getMinutes(), 0, 0)
    onClickSlot(clicked)
  }

  return (
    <div className="flex-1 min-w-0 border-r border-gray-100 last:border-r-0">
      {/* Day header */}
      <div
        className={`h-10 flex flex-col items-center justify-center text-xs font-medium ${
          isToday(day)
            ? 'text-blue-600'
            : 'text-gray-500'
        }`}
      >
        <span>{format(day, 'EEE')}</span>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
            isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-700'
          }`}
        >
          {format(day, 'd')}
        </span>
      </div>

      {/* Grid */}
      <div
        ref={colRef}
        className="relative cursor-pointer"
        style={{ height: gridHeight }}
        onClick={handleClick}
      >
        {/* Background slots */}
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
          <div
            key={i}
            className={`absolute inset-x-0 border-b ${
              i % 2 === 0 ? 'border-gray-100' : 'border-gray-50'
            }`}
            style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
          />
        ))}

        {/* Events */}
        {events.map((event) => (
          <div
            key={event.id}
            onClick={(e) => {
              e.stopPropagation()
              onClickEvent(event)
            }}
            className={`absolute inset-x-1 rounded-md border-l-4 ${STATUS_COLOR[event.status]} ${STATUS_BORDER[event.status]} bg-opacity-90 px-2 py-1 cursor-pointer overflow-hidden z-10`}
            style={{
              top: computeTop(event.startTime),
              height: computeHeight(event),
            }}
          >
            <p className="text-[11px] font-semibold text-white truncate">
              {event.title}
            </p>
            {event.contact && (
              <p className="text-[10px] text-white/80 truncate">
                {event.contact.firstName} {event.contact.lastName}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

interface CreateEventModalProps {
  open: boolean
  onClose: () => void
  calendarId: string
  defaultDuration: number
  prefillDate?: Date
  prefillTime?: Date
  prefillContact?: ContactOption
  onSuccess: () => void
}

function CreateEventModal({
  open,
  onClose,
  calendarId,
  defaultDuration,
  prefillDate,
  prefillTime,
  prefillContact,
  onSuccess,
}: CreateEventModalProps) {
  const [contactSearch, setContactSearch] = useState('')
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([])
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(
    prefillContact ?? null
  )
  const [showDropdown, setShowDropdown] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(
    prefillDate ? format(prefillDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  )
  const [startTime, setStartTime] = useState(
    prefillTime ? format(prefillTime, 'HH:mm') : '09:00'
  )
  const [endTime, setEndTime] = useState(() => {
    const base = prefillTime ?? new Date()
    base.setMinutes(base.getMinutes() + defaultDuration)
    return format(base, 'HH:mm')
  })
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync prefills when modal opens
  useEffect(() => {
    if (open) {
      setSelectedContact(prefillContact ?? null)
      setContactSearch(
        prefillContact
          ? `${prefillContact.firstName} ${prefillContact.lastName}`
          : ''
      )
      setTitle(
        prefillContact
          ? `${prefillContact.firstName} ${prefillContact.lastName}`
          : ''
      )
      setDate(prefillDate ? format(prefillDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
      const pt = prefillTime ?? new Date()
      setStartTime(format(pt, 'HH:mm'))
      const endDate = new Date(pt)
      endDate.setMinutes(endDate.getMinutes() + defaultDuration)
      setEndTime(format(endDate, 'HH:mm'))
      setNotes('')
      setError('')
    }
  }, [open, prefillDate, prefillTime, prefillContact, defaultDuration])

  const searchContacts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setContactOptions([])
      return
    }
    const res = await fetch(
      `/api/contacts?search=${encodeURIComponent(q)}&typeahead=true`
    )
    if (res.ok) {
      const data = await res.json()
      setContactOptions(Array.isArray(data.contacts) ? data.contacts : Array.isArray(data) ? data : [])
    }
  }, [])

  const handleContactInput = (val: string) => {
    setContactSearch(val)
    setShowDropdown(true)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchContacts(val), 300)
  }

  const selectContact = (c: ContactOption) => {
    setSelectedContact(c)
    setContactSearch(`${c.firstName} ${c.lastName}`)
    setTitle(`${c.firstName} ${c.lastName}`)
    setShowDropdown(false)
    setContactOptions([])
  }

  const handleStartTimeChange = (val: string) => {
    setStartTime(val)
    // Auto-adjust end time
    if (val) {
      const [h, m] = val.split(':').map(Number)
      const d = new Date()
      d.setHours(h, m + defaultDuration, 0, 0)
      setEndTime(format(d, 'HH:mm'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const startISO = `${date}T${startTime}:00`
      const endISO = `${date}T${endTime}:00`
      const res = await fetch(`/api/calendar/${calendarId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact?.id ?? undefined,
          title: title.trim(),
          startTime: startISO,
          endTime: endISO,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setError(msg || 'Failed to create event.')
        setLoading(false)
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Appointment" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Contact search */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Contact</label>
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Search contacts…"
              value={contactSearch}
              onChange={(e) => handleContactInput(e.target.value)}
              onFocus={() => contactSearch && setShowDropdown(true)}
              autoComplete="off"
            />
            {showDropdown && contactOptions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                {contactOptions.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectContact(c)}
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">
                      {c.firstName} {c.lastName}
                    </span>
                    {c.email && (
                      <span className="text-xs text-gray-400">{c.email}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            placeholder="Appointment title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Start / End time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Start Time</label>
            <input
              type="time"
              className={inputClass}
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">End Time</label>
            <input
              type="time"
              className={inputClass}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Notes</label>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y`}
            placeholder="Optional notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
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
            {loading ? 'Saving…' : 'Create Appointment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Event Slide-Over ─────────────────────────────────────────────────────────

interface EventSlideOverProps {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onUpdate: (updated: CalendarEvent) => void
  onDelete: (eventId: string) => void
  onReschedule: (contact: ContactOption | null) => void
}

function EventSlideOver({
  event,
  open,
  onClose,
  onUpdate,
  onDelete,
  onReschedule,
}: EventSlideOverProps) {
  const router = useRouter()
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmNoShow, setConfirmNoShow] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setNotes(event?.notes ?? '')
  }, [event])

  if (!event) return null

  const duration = differenceInMinutes(
    parseISO(event.endTime),
    parseISO(event.startTime)
  )

  const patchEvent = async (payload: Partial<CalendarEvent>) => {
    const res = await fetch(`/api/calendar/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated: CalendarEvent = await res.json()
      onUpdate(updated)
      return updated
    }
    return null
  }

  const handleStatusChange = async (status: CalendarEvent['status']) => {
    setUpdatingStatus(true)
    await patchEvent({ status })
    setUpdatingStatus(false)
  }

  const handleNotesBlur = async () => {
    if (notes === (event.notes ?? '')) return
    setSavingNotes(true)
    await patchEvent({ notes })
    setSavingNotes(false)
  }

  const handleCancelConfirmed = async () => {
    setConfirmCancel(false)
    await handleStatusChange('CANCELLED')
  }

  const handleNoShowConfirmed = async () => {
    setConfirmNoShow(false)
    await handleStatusChange('NO_SHOW')
  }

  const handleCompleteConfirmed = async () => {
    setConfirmComplete(false)
    await handleStatusChange('COMPLETED')
  }

  const handleDeleteConfirmed = async () => {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        onDelete(event.id)
        onClose()
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title="Appointment"
        width={440}
      >
        <div className="flex flex-col gap-5 p-5">
          {/* Contact */}
          <div>
            {event.contact ? (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">
                    {event.contact.firstName} {event.contact.lastName}
                  </p>
                  {event.contact.email && (
                    <p className="text-sm text-gray-500">{event.contact.email}</p>
                  )}
                </div>
                <button
                  onClick={() => router.push(`/contacts/${event.contact!.id}`)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-[#415A77] hover:bg-gray-50 transition-colors shrink-0"
                >
                  <ExternalLink size={12} />
                  View Contact
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No contact linked</p>
            )}
          </div>

          {/* Title */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              Appointment
            </p>
            <p className="text-sm font-semibold text-gray-900">{event.title}</p>
          </div>

          {/* Time */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              Time
            </p>
            <p className="text-sm text-gray-900">
              {formatTimeRange(event.startTime, event.endTime)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{duration} minutes</p>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">
              Status
            </p>
            <select
              value={event.status}
              disabled={updatingStatus}
              onChange={(e) =>
                handleStatusChange(e.target.value as CalendarEvent['status'])
              }
              className={`${inputClass} disabled:opacity-50`}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">
              Notes
            </p>
            <textarea
              className={`${inputClass} min-h-[88px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes…"
            />
            {savingNotes && (
              <p className="mt-1 text-xs text-gray-400">Saving…</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            {event.status === 'CONFIRMED' && (
              <>
                <button
                  onClick={() => {
                    onClose()
                    onReschedule(event.contact ?? null)
                  }}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => setConfirmComplete(true)}
                  className="w-full rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => setConfirmNoShow(true)}
                  className="w-full rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Mark No-Show
                </button>
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="w-full rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  Cancel Appointment
                </button>
              </>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete Event'}
            </button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancelConfirmed}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment?"
        confirmLabel="Cancel Appointment"
        destructive
      />
      <ConfirmDialog
        open={confirmNoShow}
        onClose={() => setConfirmNoShow(false)}
        onConfirm={handleNoShowConfirmed}
        title="Mark as No-Show"
        description="Mark this appointment as a no-show?"
        confirmLabel="Mark No-Show"
      />
      <ConfirmDialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={handleCompleteConfirmed}
        title="Mark as Completed"
        description="Mark this appointment as completed?"
        confirmLabel="Mark Completed"
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Event"
        description="Permanently delete this appointment? This also removes it from Google Calendar and cannot be undone."
        confirmLabel="Delete Event"
        destructive
      />
    </>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onClickEvent: (event: CalendarEvent) => void
  onClickDay: (day: Date) => void
}

function MonthView({
  currentDate,
  events,
  onClickEvent,
  onClickDay,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const weeksCount = getWeeksInMonth(currentDate, { weekStartsOn: 1 })
  const allDays = Array.from({ length: weeksCount * 7 }, (_, i) =>
    addDays(calStart, i)
  )

  const eventsByDay = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const key = format(parseISO(ev.startTime), 'yyyy-MM-dd')
    if (!eventsByDay.has(key)) eventsByDay.set(key, [])
    eventsByDay.get(key)!.push(ev)
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day-name header */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {dayNames.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-gray-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div
        className="flex-1 overflow-auto grid"
        style={{ gridTemplateRows: `repeat(${weeksCount}, 1fr)` }}
      >
        {Array.from({ length: weeksCount }, (_, w) => (
          <div key={w} className="grid grid-cols-7 border-b border-gray-100">
            {allDays.slice(w * 7, w * 7 + 7).map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay.get(key) ?? []
              const overflow = dayEvents.length - 3
              const inMonth = isSameMonth(day, currentDate)

              return (
                <div
                  key={key}
                  onClick={() => onClickDay(day)}
                  className={`relative flex flex-col gap-0.5 p-1.5 border-r border-gray-100 last:border-r-0 cursor-pointer min-h-[90px] hover:bg-gray-50/60 transition-colors ${
                    !inMonth ? 'bg-gray-50/40' : ''
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium self-end ${
                      isToday(day)
                        ? 'bg-blue-600 text-white'
                        : inMonth
                        ? 'text-gray-700'
                        : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <MonthEventChip
                        key={ev.id}
                        event={ev}
                        onClick={() => onClickEvent(ev)}
                      />
                    ))}
                    {overflow > 0 && (
                      <p className="text-[9px] font-medium text-gray-400 pl-1">
                        +{overflow} more
                      </p>
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

// ─── Week View ────────────────────────────────────────────────────────────────

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onClickSlot: (time: Date) => void
  onClickEvent: (event: CalendarEvent) => void
}

function WeekView({
  currentDate,
  events,
  onClickSlot,
  onClickEvent,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const eventsByDay = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const key = format(parseISO(ev.startTime), 'yyyy-MM-dd')
    if (!eventsByDay.has(key)) eventsByDay.set(key, [])
    eventsByDay.get(key)!.push(ev)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <TimeColumn />
      <div className="flex flex-1 overflow-x-auto">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          return (
            <DayColumn
              key={key}
              day={day}
              events={eventsByDay.get(key) ?? []}
              onClickSlot={onClickSlot}
              onClickEvent={onClickEvent}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Day View ─────────────────────────────────────────────────────────────────

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onClickSlot: (time: Date) => void
  onClickEvent: (event: CalendarEvent) => void
}

function DayView({
  currentDate,
  events,
  onClickSlot,
  onClickEvent,
}: DayViewProps) {
  const key = format(currentDate, 'yyyy-MM-dd')
  const dayEvents = events.filter(
    (ev) => format(parseISO(ev.startTime), 'yyyy-MM-dd') === key
  )

  return (
    <div className="flex flex-1 overflow-hidden">
      <TimeColumn />
      <div className="flex flex-1 overflow-x-auto">
        <DayColumn
          day={currentDate}
          events={dayEvents}
          onClickSlot={onClickSlot}
          onClickEvent={onClickEvent}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarDetailPage() {
  const router = useRouter()
  const params = useParams()
  const calendarId = params.id as string

  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Create event modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createPrefillDate, setCreatePrefillDate] = useState<Date | undefined>()
  const [createPrefillTime, setCreatePrefillTime] = useState<Date | undefined>()
  const [createPrefillContact, setCreatePrefillContact] = useState<
    ContactOption | null
  >(null)

  // Event slide-over
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventSlideOver, setShowEventSlideOver] = useState(false)

  // ─── Load config ────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true)
      try {
        const res = await fetch(`/api/calendar/${calendarId}`)
        if (res.ok) {
          const data: CalendarConfig = await res.json()
          setConfig(data)
        }
      } finally {
        setConfigLoading(false)
      }
    }
    loadConfig()
  }, [calendarId])

  // ─── Load events ────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    let from: Date
    let to: Date

    if (viewMode === 'week') {
      from = startOfWeek(currentDate, { weekStartsOn: 1 })
      to = endOfWeek(currentDate, { weekStartsOn: 1 })
    } else if (viewMode === 'day') {
      from = startOfDay(currentDate)
      to = endOfDay(currentDate)
    } else {
      from = startOfMonth(currentDate)
      to = endOfMonth(currentDate)
    }

    setEventsLoading(true)
    try {
      const res = await fetch(
        `/api/calendar/${calendarId}/events?from=${from.toISOString()}&to=${to.toISOString()}`
      )
      if (res.ok) {
        const data = await res.json()
        setEvents(Array.isArray(data) ? data : [])
      }
    } finally {
      setEventsLoading(false)
    }
  }, [calendarId, viewMode, currentDate])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const goNext = () => {
    if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1))
    else if (viewMode === 'month') setCurrentDate((d) => addMonths(d, 1))
    else setCurrentDate((d) => addDays(d, 1))
  }

  const goPrev = () => {
    if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1))
    else if (viewMode === 'month') setCurrentDate((d) => subMonths(d, 1))
    else setCurrentDate((d) => subDays(d, 1))
  }

  const goToday = () => setCurrentDate(new Date())

  // ─── Header label ────────────────────────────────────────────────────────────

  const headerLabel = (() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy')
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy')
    // week
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
    const we = endOfWeek(currentDate, { weekStartsOn: 1 })
    if (isSameMonth(ws, we)) {
      return `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
    }
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
  })()

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const openCreateModal = (date: Date, time?: Date) => {
    setCreatePrefillDate(date)
    setCreatePrefillTime(time)
    setCreatePrefillContact(null)
    setShowCreateModal(true)
  }

  const openReschedule = (contact: ContactOption | null) => {
    setCreatePrefillContact(contact)
    setCreatePrefillDate(new Date())
    setCreatePrefillTime(undefined)
    setShowCreateModal(true)
  }

  const handleEventUpdate = (updated: CalendarEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setSelectedEvent(updated)
  }

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setSelectedEvent(null)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventSlideOver(true)
  }

  const handleSlotClick = (time: Date) => {
    openCreateModal(time, time)
  }

  const handleDayClick = (day: Date) => {
    openCreateModal(day)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (configLoading) {
    return (
      <div className="px-6 py-6">
        <LoadingSkeleton variant="card" count={1} />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="px-6 py-6">
        <EmptyState
          icon={CalendarDays}
          title="Calendar not found"
          description="This calendar does not exist or has been deleted."
          action={
            <button
              onClick={() => router.push('/calendar')}
              className="rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors"
            >
              Back to Calendars
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shrink-0">
        {/* Back */}
        <button
          onClick={() => router.push('/calendar')}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
        >
          <ChevronLeft size={15} />
          Calendars
        </button>

        {/* Calendar name */}
        <h1 className="flex-1 truncate text-sm font-semibold text-gray-900">
          {config.name}
        </h1>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                viewMode === v
                  ? 'bg-[#0D1B2A] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={goPrev}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Date label */}
        <span className="text-sm font-medium text-gray-700 shrink-0 min-w-[160px] text-right">
          {headerLabel}
        </span>

        {/* New event button */}
        <button
          onClick={() => openCreateModal(currentDate)}
          className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B263B] transition-colors shrink-0"
        >
          + New
        </button>
      </div>

      {/* Loading overlay for events */}
      {eventsLoading && (
        <div className="h-1 w-full bg-blue-100 shrink-0">
          <div className="h-full w-1/3 animate-pulse bg-blue-400 rounded-full" />
        </div>
      )}

      {/* Calendar body */}
      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onClickSlot={handleSlotClick}
            onClickEvent={handleEventClick}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            events={events}
            onClickSlot={handleSlotClick}
            onClickEvent={handleEventClick}
          />
        )}
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onClickEvent={handleEventClick}
            onClickDay={handleDayClick}
          />
        )}
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        calendarId={calendarId}
        defaultDuration={config.duration}
        prefillDate={createPrefillDate}
        prefillTime={createPrefillTime}
        prefillContact={createPrefillContact ?? undefined}
        onSuccess={() => {
          loadEvents()
          setShowCreateModal(false)
        }}
      />

      {/* Event Slide-Over */}
      <EventSlideOver
        event={selectedEvent}
        open={showEventSlideOver}
        onClose={() => {
          setShowEventSlideOver(false)
          setSelectedEvent(null)
        }}
        onUpdate={handleEventUpdate}
        onDelete={handleEventDelete}
        onReschedule={(contact) => {
          setShowEventSlideOver(false)
          setSelectedEvent(null)
          openReschedule(contact)
        }}
      />
    </div>
  )
}
