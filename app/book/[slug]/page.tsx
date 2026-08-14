'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { zonedWallTimeToUtc } from '@/lib/timezone'
// Plain dompurify, not isomorphic-dompurify. The isomorphic build pulls jsdom in
// on the server, and jsdom's html-encoding-sniffer now require()s an ESM-only
// package, which throws ERR_REQUIRE_ESM and 500s the whole route. Sanitizing runs
// after mount (see LeftPanel), so the browser DOM is always available.
import DOMPurify from 'dompurify'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isBefore,
  isToday,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarConfig = {
  id: string
  name: string
  type: string
  duration: number
  timezone: string
  description?: string | null
  confirmationMessage?: string | null
  dateRange?: number | null
  dateRangeUnit?: string | null
}

type BookedEvent = {
  startTime: string
  endTime: string
  title: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

function toDateISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function formatGoogleDate(iso: string): string {
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// ─── Timezones ────────────────────────────────────────────────────────────────
//
// Slots arrive from /api/calendar/availability as wall-clock strings in the
// *calendar's* timezone, and /api/calendar/book expects that same wall-clock
// string back. So the visitor's timezone is a display concern only: we convert
// each slot to an absolute instant using the calendar's zone, then render it in
// whichever zone the visitor picked. The raw slot string is what gets submitted.

const TZ_STORAGE_KEY = 'jf-booking-timezone'

const DEFAULT_TIMEZONE = 'America/New_York'

// US zones only — the audience is US firms, so the full IANA list is noise.
// Ordered east to west. Labels use the names people actually say, not IANA
// city names ("Eastern Time", not "New York").
const US_TIMEZONES: { tz: string; label: string }[] = [
  { tz: 'America/Puerto_Rico', label: 'Atlantic Time — Puerto Rico' },
  { tz: 'America/New_York', label: 'Eastern Time' },
  { tz: 'America/Chicago', label: 'Central Time' },
  { tz: 'America/Denver', label: 'Mountain Time' },
  { tz: 'America/Phoenix', label: 'Arizona — no daylight saving' },
  { tz: 'America/Los_Angeles', label: 'Pacific Time' },
  { tz: 'America/Anchorage', label: 'Alaska Time' },
  { tz: 'Pacific/Honolulu', label: 'Hawaii Time' },
]

function isSupportedTimezone(tz: string | null | undefined): boolean {
  return !!tz && US_TIMEZONES.some((z) => z.tz === tz)
}

function tzLabel(tz: string): string {
  return US_TIMEZONES.find((z) => z.tz === tz)?.label ?? tz
}

function getBrowserTimezoneId(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

// Minutes east of UTC for `timeZone` at `at`, via the shortOffset name.
function tzOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name)
    if (!m) return 0 // bare "GMT"
    const sign = m[1] === '-' ? -1 : 1
    return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
  } catch {
    return 0
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const h = String(Math.floor(abs / 60)).padStart(2, '0')
  const m = String(abs % 60).padStart(2, '0')
  return `GMT${sign}${h}:${m}`
}

// YYYY-MM-DD for an instant, as seen in `timeZone`.
function isoDateIn(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

type ConvertedSlot = { time: string; dayShift: number }

/**
 * Render a calendar-timezone slot ("09:00" on `dateISO`) as it reads in
 * `viewerTz`. `dayShift` is -1/0/+1 when the conversion crosses midnight, so the
 * UI can flag that a slot lands on a neighbouring day for this visitor.
 */
function convertSlot(dateISO: string, slot: string, calendarTz: string, viewerTz: string): ConvertedSlot {
  const instant = zonedWallTimeToUtc(dateISO, slot, calendarTz)
  if (Number.isNaN(instant.getTime())) return { time: formatTime12(slot), dayShift: 0 }
  try {
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTz, hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(instant)
    const viewerDay = isoDateIn(instant, viewerTz)
    const dayShift = viewerDay === dateISO ? 0 : viewerDay > dateISO ? 1 : -1
    return { time, dayShift }
  } catch {
    return { time: formatTime12(slot), dayShift: 0 }
  }
}

// ─── Shared presentation bits ─────────────────────────────────────────────────

const FIELD_LABEL = 'jf-label mb-2 block'

// Single Cormorant italic word per headline — the one sanctioned accent use.
function Heading({ lead, accent }: { lead: string; accent: string }) {
  return (
    <h2 className="jf-display text-[22px] leading-tight text-[var(--jf-t100)] sm:text-[26px]">
      {lead} <span className="jf-accent">{accent}</span>
    </h2>
  )
}

// Native select on purpose: it gives a proper wheel on mobile and keyboard
// type-ahead on desktop for free.
function TimezoneSelect({
  value,
  onChange,
  atDate,
}: {
  value: string
  onChange: (tz: string) => void
  // Offsets are resolved against the date being booked, so a slot on the far
  // side of a DST change shows the offset that will actually apply.
  atDate: Date
}) {
  const options = useMemo(
    () => US_TIMEZONES.map((z) => ({ ...z, offset: tzOffsetMinutes(z.tz, atDate) })),
    [atDate]
  )

  return (
    <div className="jf-select-wrap">
      <select
        className="jf-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Time zone"
      >
        {options.map((z) => (
          <option key={z.tz} value={z.tz}>
            {`${z.label} · ${formatOffset(z.offset)}`}
          </option>
        ))}
      </select>
      <svg className="jf-select-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-[rgba(92,80,63,0.5)] border-t-[var(--jf-gold)]"
      style={{ height: size, width: size }}
    />
  )
}

// ─── Left panel — meeting info ────────────────────────────────────────────────

function LeftPanel({
  config,
  selectedDate,
  selectedTime,
  onBack,
  viewerTz,
}: {
  config: CalendarConfig
  selectedDate: string
  selectedTime: string
  onBack?: () => void
  viewerTz: string
}) {
  // Once a time is chosen, show the date the visitor's own zone puts it on —
  // for far-east/west visitors that can be the day either side of the slot's
  // calendar-timezone date.
  const instant = selectedTime
    ? zonedWallTimeToUtc(selectedDate, selectedTime, config.timezone)
    : null
  const displayDate = instant && !Number.isNaN(instant.getTime())
    ? isoDateIn(instant, viewerTz)
    : selectedDate

  const dateLabel = displayDate
    ? format(new Date(displayDate + 'T12:00:00'), 'EEE, MMM d, yyyy')
    : null
  const timeLabel = selectedTime
    ? convertSlot(selectedDate, selectedTime, config.timezone, viewerTz).time
    : null

  // Sanitize after mount so DOMPurify only ever runs against a real browser DOM.
  const [cleanDescription, setCleanDescription] = useState<string | null>(null)

  useEffect(() => {
    if (!config.description) {
      setCleanDescription(null)
      return
    }
    setCleanDescription(
      DOMPurify.sanitize(config.description, {
        ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'span'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      })
    )
  }, [config.description])

  return (
    <div className="w-full shrink-0 border-b border-[var(--jf-line-soft)] px-7 py-8 sm:px-9 lg:w-[320px] lg:border-b-0 lg:border-r lg:py-10">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-7 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(92,80,63,0.5)] text-[var(--jf-t70)] transition-colors hover:border-[rgba(189,157,98,0.45)] hover:bg-[var(--jf-fill)] hover:text-[var(--jf-t100)]"
          aria-label="Back"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Logo */}
      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jf-digital-logo.png" alt="JF Digital" className="h-11 w-auto object-contain" />
      </div>

      <p className="jf-eyebrow mb-3">JF Digital</p>
      <h1 className="jf-display text-[26px] leading-[1.15] text-[var(--jf-t100)]">{config.name}</h1>

      <div className="my-6 h-px w-full bg-[var(--jf-line-soft)]" />

      {/* Duration */}
      <div className="mb-3 flex items-center gap-2.5">
        <svg className="h-4 w-4 shrink-0 text-[var(--jf-t38)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        </svg>
        <span className="text-[13px] text-[var(--jf-t60)]">{config.duration} min</span>
      </div>

      {/* Selected date/time (once chosen) */}
      {dateLabel && (
        <div className="mb-3 flex items-center gap-2.5">
          <svg className="h-4 w-4 shrink-0 text-[var(--jf-t38)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[13px] text-[var(--jf-t80)]">
            {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
          </span>
        </div>
      )}

      {/* Description */}
      {cleanDescription && (
        <div
          className="jf-prose mt-6"
          dangerouslySetInnerHTML={{ __html: cleanDescription }}
        />
      )}
    </div>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function Calendar({
  selectedDate,
  onDateClick,
  loadingDate,
  maxDate,
}: {
  selectedDate: string
  onDateClick: (day: Date) => void
  loadingDate: string | null
  maxDate?: Date | null
}) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today)

  const calendarStart = startOfWeek(startOfMonth(viewMonth))
  const calendarEnd = endOfWeek(endOfMonth(viewMonth))
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    viewMonth.getMonth() > today.getMonth()

  const canGoNext = maxDate
    ? viewMonth.getFullYear() < maxDate.getFullYear() ||
      (viewMonth.getFullYear() === maxDate.getFullYear() && viewMonth.getMonth() < maxDate.getMonth())
    : true

  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(92,80,63,0.5)] text-[var(--jf-t70)] transition-colors hover:border-[rgba(189,157,98,0.45)] hover:bg-[var(--jf-fill)] hover:text-[var(--jf-t100)] disabled:cursor-not-allowed disabled:border-[var(--jf-line-soft)] disabled:text-[var(--jf-t22)] disabled:hover:bg-transparent'

  return (
    <div className="w-full sm:min-w-[320px]">
      {/* Month nav */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          disabled={!canGoPrev}
          className={navBtn}
          aria-label="Previous month"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="jf-display text-[16px] text-[var(--jf-t100)]">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={!canGoNext}
          className={navBtn}
          aria-label="Next month"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-2 grid grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--jf-t38)]">
            {d.slice(0, 3)}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isPast = isBefore(day, today) && !isToday(day)
          const isBeyondMax = maxDate ? isBefore(maxDate, day) : false
          const isOutside = !isSameMonth(day, viewMonth)
          const isSelected = selectedDate
            ? isSameDay(day, new Date(selectedDate + 'T12:00:00'))
            : false
          const isTodayDay = isToday(day)
          const isLoading = loadingDate === toDateISO(day)

          if (isOutside) {
            return <div key={day.toString()} className="h-10" />
          }

          return (
            <div key={day.toString()} className="flex flex-col items-center py-1">
              <button
                disabled={isPast || isBeyondMax}
                onClick={() => onDateClick(day)}
                className={[
                  'relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-all duration-200',
                  isSelected
                    ? 'bg-[var(--jf-gold)] font-medium text-[#1b1b1b] shadow-[0_6px_20px_rgba(189,157,98,0.28)]'
                    : isPast || isBeyondMax
                    ? 'cursor-not-allowed text-[var(--jf-t22)]'
                    : 'cursor-pointer text-[var(--jf-t80)] hover:bg-[var(--jf-fill-hover)] hover:text-[var(--jf-t100)]',
                  isLoading ? 'opacity-60' : '',
                ].join(' ')}
              >
                {format(day, 'd')}
              </button>
              {/* Today dot */}
              {isTodayDay && (
                <div className="mt-0.5 h-1 w-1 rounded-full bg-[var(--jf-gold)]" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Time slots ───────────────────────────────────────────────────────────────

function TimeSlots({
  slots,
  selectedTime,
  loading,
  onSelect,
  selectedDate,
  calendarTz,
  viewerTz,
}: {
  slots: string[]
  selectedTime: string
  loading: boolean
  onSelect: (time: string) => void
  selectedDate: string
  calendarTz: string
  viewerTz: string
}) {
  // Fade the bottom edge only when the column is actually clipped, so a short
  // list of slots doesn't render its last option half-dissolved.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      setClipped(false)
      return
    }
    const measure = () => setClipped(el.scrollHeight - el.clientHeight > 4)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [slots])

  if (loading) {
    return (
      <div className="flex w-full items-start justify-center pt-8">
        <Spinner />
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="flex w-full items-start pt-6 lg:pt-8">
        <p className="w-full text-center text-[12px] leading-relaxed text-[var(--jf-t38)] lg:text-left">
          Select a date to see available times
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={[
        'jf-scroll grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 lg:max-h-[380px] lg:grid-cols-1 lg:overflow-y-auto lg:pr-2',
        clipped ? 'jf-scroll-fade' : '',
      ].join(' ')}
    >
      {slots.map((slot) => {
        const active = selectedTime === slot
        const { time, dayShift } = convertSlot(selectedDate, slot, calendarTz, viewerTz)
        return (
          <button
            key={slot}
            onClick={() => onSelect(slot)}
            className={[
              'w-full rounded-full border py-2.5 text-[13px] transition-all duration-200',
              active
                ? 'border-transparent bg-[var(--jf-gold)] font-medium text-[#1b1b1b] shadow-[0_6px_20px_rgba(189,157,98,0.25)]'
                : 'border-[rgba(92,80,63,0.5)] text-[var(--jf-t80)] hover:-translate-y-px hover:border-[rgba(189,157,98,0.45)] hover:bg-[var(--jf-fill)] hover:text-[var(--jf-t100)]',
            ].join(' ')}
          >
            {time}
            {dayShift !== 0 && (
              <sup className="ml-1 text-[9px] opacity-70">
                {dayShift > 0 ? '+1' : '−1'}
              </sup>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Booking form (step 2) ────────────────────────────────────────────────────

type MatchedContact = {
  id: string
  firstName: string
}

function BookingForm({
  config,
  selectedDate,
  selectedTime,
  onBooked,
}: {
  config: CalendarConfig
  selectedDate: string
  selectedTime: string
  onBooked: (event: BookedEvent) => void
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Contact lookup state
  const [matchedContact, setMatchedContact] = useState<MatchedContact | null>(null)
  const [confirmedContactId, setConfirmedContactId] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  async function lookupContact(email: string, phone: string) {
    // Don't re-lookup if already confirmed
    if (confirmedContactId) return
    const params = new URLSearchParams()
    if (email) params.set('email', email)
    if (phone) params.set('phone', phone)
    if (!email && !phone) return
    setLookingUp(true)
    try {
      const res = await fetch(`/api/calendar/lookup-contact?${params}`)
      const data = await res.json()
      if (data.found) {
        setMatchedContact(data.contact)
      }
    } catch {
      // Lookup failure is non-fatal
    } finally {
      setLookingUp(false)
    }
  }

  function handleConfirmMatch() {
    if (!matchedContact) return
    // Link the booking to the existing contact and greet by first name. Other
    // details stay as the visitor typed them — the API no longer returns them.
    setConfirmedContactId(matchedContact.id)
    setForm((f) => ({ ...f, firstName: matchedContact.firstName }))
    setMatchedContact(null)
  }

  function handleDenyMatch() {
    setMatchedContact(null)
    setConfirmedContactId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calId: config.id,
          date: selectedDate,
          time: selectedTime,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
          confirmedContactId: confirmedContactId ?? undefined,
        }),
      })
      const data = res.ok ? await res.json() : null
      if (data?.success) {
        onBooked(data.event)
      } else {
        const errData = !res.ok ? await res.json().catch(() => ({})) : data
        setError(errData?.error ?? 'Booking failed. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 px-7 py-8 sm:px-9 lg:px-10 lg:py-10">
      <Heading lead="Your" accent="details" />

      <form onSubmit={handleSubmit} className="mt-7 max-w-[440px] space-y-4">

        {/* Welcome back banner */}
        {matchedContact && (
          <div className="jf-rise rounded-xl border border-[rgba(189,157,98,0.3)] bg-[var(--jf-fill)] px-4 py-4">
            <p className="jf-display mb-1 text-[16px] text-[var(--jf-t100)]">
              Welcome back, {matchedContact.firstName}.
            </p>
            <p className="mb-3.5 text-[12.5px] text-[var(--jf-t55)]">
              We found your profile — want to use it?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={handleConfirmMatch} className="jf-btn jf-btn-sm">
                <span className="jf-btn-shimmer" />
                Yes, that&apos;s me
              </button>
              <button type="button" onClick={handleDenyMatch} className="jf-btn-ghost jf-btn-sm">
                Not me
              </button>
            </div>
          </div>
        )}

        {/* Confirmed badge */}
        {confirmedContactId && (
          <div className="flex items-center justify-between rounded-lg border border-[rgba(189,157,98,0.28)] bg-[var(--jf-fill)] px-3.5 py-2.5">
            <p className="flex items-center gap-2 text-[12px] text-[var(--jf-t80)]">
              <svg className="h-3.5 w-3.5 text-[var(--jf-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Using your existing profile
            </p>
            <button type="button" onClick={() => { setConfirmedContactId(null); setMatchedContact(null) }}
              className="text-[12px] text-[var(--jf-t55)] underline underline-offset-2 transition-colors hover:text-[var(--jf-t100)]">
              Change
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>
              First name <span className="text-[var(--jf-t38)]">*</span>
            </label>
            <input required className="jf-input" value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <label className={FIELD_LABEL}>
              Last name <span className="text-[var(--jf-t38)]">*</span>
            </label>
            <input required className="jf-input" value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL}>
            Email <span className="text-[var(--jf-t38)]">*</span>
          </label>
          <div className="relative">
            <input
              required
              type="email"
              className="jf-input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              onBlur={(e) => { if (!confirmedContactId) lookupContact(e.target.value, form.phone) }}
            />
            {lookingUp && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size={16} />
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL}>
            Phone <span className="text-[var(--jf-t38)]">*</span>
          </label>
          <input
            required
            type="tel"
            className="jf-input"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            onBlur={(e) => { if (!confirmedContactId && !matchedContact) lookupContact(form.email, e.target.value) }}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>
            Notes <span className="text-[var(--jf-t30)]">(optional)</span>
          </label>
          <textarea rows={3} className="jf-input resize-none" value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[rgba(189,157,98,0.4)] bg-[rgba(92,80,63,0.22)] px-3.5 py-2.5 text-[12.5px] text-[var(--jf-t100)]"
          >
            <svg className="mt-px h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 7v6" />
              <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
            </svg>
            {error}
          </p>
        )}

        <div className="pt-1">
          <button type="submit" disabled={submitting} className="jf-btn">
            <span className="jf-btn-shimmer" />
            {submitting ? 'Confirming…' : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessCard({
  config,
  event,
  onReset,
  viewerTz,
}: {
  config: CalendarConfig
  event: BookedEvent
  onReset: () => void
  viewerTz: string
}) {
  const startDate = new Date(event.startTime)
  // event.startTime is an absolute instant, so render it in the zone the visitor
  // picked and name that zone — an unlabelled time is how people miss calls.
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(startDate)
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  }).format(startDate)

  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(config.name)}` +
    `&dates=${formatGoogleDate(event.startTime)}/${formatGoogleDate(event.endTime)}`

  return (
    <div className="jf-rise flex flex-1 flex-col items-center justify-center px-7 py-12 sm:px-9 lg:px-10">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(189,157,98,0.35)] bg-[var(--jf-fill)] shadow-[0_0_40px_rgba(189,157,98,0.14)]">
        <svg className="h-6 w-6 text-[var(--jf-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="jf-display mb-2 text-center text-[26px] text-[var(--jf-t100)]">
        Booking <span className="jf-accent">confirmed</span>.
      </h2>
      <p className="mb-7 text-center text-[13px] text-[var(--jf-t55)]">
        A confirmation email is on its way.
      </p>

      <div className="mb-5 w-full max-w-[320px] rounded-xl border border-[var(--jf-line)] bg-[rgba(189,157,98,0.035)] p-5">
        <p className="jf-eyebrow mb-2.5">Your appointment</p>
        <p className="jf-display mb-2 text-[18px] leading-snug text-[var(--jf-t100)]">{config.name}</p>
        <p className="text-[13px] text-[var(--jf-t80)]">{dateLabel}</p>
        <p className="text-[13px] text-[var(--jf-t80)]">{timeLabel}</p>
        <p className="mt-2 text-[12px] text-[var(--jf-t38)]">{config.duration} minutes</p>
      </div>

      {config.confirmationMessage && (
        <p className="mb-6 w-full max-w-[320px] rounded-xl border border-[var(--jf-line-soft)] p-4 text-left text-[13px] leading-relaxed text-[var(--jf-t60)]">
          {config.confirmationMessage}
        </p>
      )}

      <div className="flex w-full max-w-[320px] flex-col gap-3">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="jf-btn">
          <span className="jf-btn-shimmer" />
          Add to Google Calendar
        </a>
        <button onClick={onReset} className="jf-btn-ghost jf-btn-quiet">
          Book Another
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BookingPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configNotFound, setConfigNotFound] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [noSlots, setNoSlots] = useState(false)
  const [loadingDate, setLoadingDate] = useState<string | null>(null)

  const [view, setView] = useState<'picker' | 'form' | 'success'>('picker')
  const [booked, setBooked] = useState<BookedEvent | null>(null)

  // Default to the browser's zone, but remember an explicit choice so someone
  // who books while travelling isn't re-correcting it every visit. Resolved
  // after mount so the server and first client render agree.
  const [viewerTz, setViewerTz] = useState(DEFAULT_TIMEZONE)
  const tzResolved = useRef(false)

  useEffect(() => {
    // Wait for the config so the calendar's own zone can act as the fallback.
    if (!config || tzResolved.current) return
    tzResolved.current = true

    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(TZ_STORAGE_KEY)
    } catch {
      // Private mode / blocked storage — fall through to detection.
    }

    // Prefer a remembered choice, then the browser's zone, then the calendar's
    // own zone. A visitor outside the US lands on the calendar's zone, which is
    // the one the times are really in — and the select labels it plainly.
    const candidates = [stored, getBrowserTimezoneId(), config.timezone]
    setViewerTz(candidates.find(isSupportedTimezone) ?? DEFAULT_TIMEZONE)
  }, [config])

  const handleTimezoneChange = useCallback((tz: string) => {
    setViewerTz(tz)
    try {
      window.localStorage.setItem(TZ_STORAGE_KEY, tz)
    } catch {
      // Non-fatal: the selection still applies for this session.
    }
  }, [])

  const maxDate = (() => {
    if (!config?.dateRange) return null
    const unit = config.dateRangeUnit ?? 'days'
    const ms = unit === 'hours'
      ? config.dateRange * 60 * 60 * 1000
      : config.dateRange * 24 * 60 * 60 * 1000
    return new Date(Date.now() + ms)
  })()

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/calendar/by-slug/${slug}`)
        if (!res.ok) { setConfigNotFound(true); return }
        const data: CalendarConfig = await res.json()
        setConfig(data)
      } catch {
        setConfigNotFound(true)
      } finally {
        setConfigLoading(false)
      }
    }
    loadConfig()
  }, [slug])

  const handleDateClick = useCallback(async (day: Date) => {
    const iso = toDateISO(day)
    setSelectedDate(iso)
    setSelectedTime('')
    setSlots([])
    setNoSlots(false)
    setSlotsLoading(true)
    setLoadingDate(iso)
    try {
      const res = await fetch(`/api/calendar/availability?calId=${config!.id}&date=${iso}`)
      const data: { available: boolean; slots: string[] } = await res.json()
      if (data.available && data.slots.length > 0) {
        setSlots(data.slots)
      } else {
        setNoSlots(true)
      }
    } finally {
      setSlotsLoading(false)
      setLoadingDate(null)
    }
  }, [config])

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time)
    setView('form')
  }, [])

  const handleBooked = useCallback((event: BookedEvent) => {
    setBooked(event)
    setView('success')
  }, [])

  function handleReset() {
    setView('picker')
    setSelectedDate('')
    setSelectedTime('')
    setSlots([])
    setBooked(null)
    setNoSlots(false)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (configLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={30} />
      </div>
    )
  }

  if (configNotFound || !config) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jf-digital-logo.png" alt="JF Digital" className="mb-7 h-10 w-auto object-contain opacity-70" />
        <h1 className="jf-display mb-2 text-[26px] text-[var(--jf-t100)]">
          Link <span className="jf-accent">unavailable</span>.
        </h1>
        <p className="text-[13px] text-[var(--jf-t55)]">This booking page could not be found.</p>
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:py-14">
      <div className="jf-card jf-rise flex flex-col overflow-hidden lg:flex-row">
        {/* Left panel */}
        <LeftPanel
          config={config}
          selectedDate={selectedDate}
          selectedTime={view === 'form' ? selectedTime : ''}
          onBack={view === 'form' ? () => { setView('picker'); setSelectedTime('') } : undefined}
          viewerTz={viewerTz}
        />

        {/* Right panel */}
        {view === 'picker' && (
          <div className="flex flex-1 flex-col px-7 py-8 sm:px-9 lg:px-10 lg:py-10">
            <Heading lead="Select date &" accent="time" />

            <div className="mt-7 flex flex-col items-start gap-8 lg:flex-row lg:gap-0">
              {/* Calendar */}
              <div className="w-full shrink-0 lg:w-auto">
                <Calendar
                  selectedDate={selectedDate}
                  onDateClick={handleDateClick}
                  loadingDate={loadingDate}
                  maxDate={maxDate}
                />
              </div>

              {/* Divider */}
              <div
                className="hidden w-px bg-[var(--jf-line-soft)] lg:mx-8 lg:block"
                style={{ minHeight: '360px' }}
              />

              {/* Time slots */}
              <div className="w-full lg:max-w-[220px] lg:flex-1">
                {noSlots && !slotsLoading && (
                  <p className="mb-3 text-[12px] text-[var(--jf-t60)]">
                    No times available on this date.
                  </p>
                )}
                <TimeSlots
                  slots={slots}
                  selectedTime={selectedTime}
                  loading={slotsLoading}
                  onSelect={handleTimeSelect}
                  selectedDate={selectedDate}
                  calendarTz={config.timezone}
                  viewerTz={viewerTz}
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="mt-9 border-t border-[var(--jf-line-soft)] pt-5">
              <p className="jf-eyebrow mb-2">Time zone</p>
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 shrink-0 text-[var(--jf-t38)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <TimezoneSelect
                  value={viewerTz}
                  onChange={handleTimezoneChange}
                  atDate={selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date()}
                />
              </div>
              <p className="mt-2 text-[11px] text-[var(--jf-t30)]">
                Times shown in {tzLabel(viewerTz)}.
              </p>
            </div>
          </div>
        )}

        {view === 'form' && (
          <BookingForm
            config={config}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onBooked={handleBooked}
          />
        )}

        {view === 'success' && booked && (
          <SuccessCard config={config} event={booked} onReset={handleReset} viewerTz={viewerTz} />
        )}
      </div>

      <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.26em] text-[var(--jf-t22)]">
        JF Digital
      </p>
    </div>
  )
}
