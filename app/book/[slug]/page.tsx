'use client'

import { useEffect, useState, useCallback } from 'react'
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

function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offset = -new Date().getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const abs = Math.abs(offset)
    const h = String(Math.floor(abs / 60)).padStart(2, '0')
    const m = String(abs % 60).padStart(2, '0')
    const abbr = new Intl.DateTimeFormat('en', { timeZoneName: 'short', timeZone: tz })
      .formatToParts()
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
    return `GMT${sign}${h}:${m} ${tz} (${abbr})`
  } catch {
    return 'America/New_York'
  }
}

// ─── Input class ──────────────────────────────────────────────────────────────

const INPUT =
  'w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#6b8fa8] focus:ring-2 focus:ring-[#6b8fa8]/20 transition-colors placeholder:text-gray-400'

// ─── Left panel — meeting info ────────────────────────────────────────────────

function LeftPanel({
  config,
  selectedDate,
  selectedTime,
  onBack,
}: {
  config: CalendarConfig
  selectedDate: string
  selectedTime: string
  onBack?: () => void
}) {
  const dateLabel = selectedDate
    ? format(new Date(selectedDate + 'T12:00:00'), 'EEE, MMM d, yyyy')
    : null
  const timeLabel = selectedTime ? formatTime12(selectedTime) : null

  return (
    <div className="w-[300px] shrink-0 px-8 py-10 border-r border-[#d1d5db]">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-8 flex h-9 w-9 items-center justify-center rounded-full border border-[#c5ccd4] bg-transparent hover:bg-[#d8dde3] transition-colors"
          aria-label="Back"
        >
          <svg className="h-4 w-4 text-[#4a5568]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Logo */}
      <div className="mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jf-digital-logo.png" alt="JF Digital" className="h-10 w-auto object-contain" />
      </div>

      <p className="text-xs font-semibold text-[#4a5568] mb-1">JF Digital</p>
      <h1 className="text-2xl font-bold text-[#1a2535] mb-5">{config.name}</h1>

      {/* Duration */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="h-4 w-4 text-[#6b7d8e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        </svg>
        <span className="text-sm text-[#4a5568] font-medium">{config.duration} min</span>
      </div>

      {/* Selected date/time (once chosen) */}
      {dateLabel && (
        <div className="flex items-center gap-2 mb-3">
          <svg className="h-4 w-4 text-[#6b7d8e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-sm text-[#4a5568] font-medium">
            {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
          </span>
        </div>
      )}

      {/* Description */}
      {config.description && (
        <p className="mt-5 text-sm text-[#6b7d8e] leading-relaxed">{config.description}</p>
      )}
    </div>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function Calendar({
  selectedDate,
  onDateClick,
  loadingDate,
}: {
  selectedDate: string
  onDateClick: (day: Date) => void
  loadingDate: string | null
}) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today)

  const calendarStart = startOfWeek(startOfMonth(viewMonth))
  const calendarEnd = endOfWeek(endOfMonth(viewMonth))
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    viewMonth.getMonth() > today.getMonth()

  return (
    <div className="min-w-[340px]">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          disabled={!canGoPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8dde3] text-[#4a5568] hover:bg-[#c8d0d8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-[#1a2535]">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8dde3] text-[#4a5568] hover:bg-[#c8d0d8] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs text-[#9ca3af] font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isPast = isBefore(day, today) && !isToday(day)
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
                disabled={isPast}
                onClick={() => onDateClick(day)}
                className={[
                  'relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-[#4b6070] text-white'
                    : isPast
                    ? 'text-[#c0c8d0] cursor-not-allowed'
                    : 'text-[#4a7fa8] hover:bg-[#4a7fa8]/10 cursor-pointer',
                  isLoading ? 'opacity-60' : '',
                ].join(' ')}
              >
                {format(day, 'd')}
              </button>
              {/* Today dot */}
              {isTodayDay && (
                <div className="h-1 w-1 rounded-full bg-[#4b6070] mt-0.5" />
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
}: {
  slots: string[]
  selectedTime: string
  loading: boolean
  onSelect: (time: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-start justify-center pt-8 w-full">
        <div className="h-6 w-6 rounded-full border-2 border-[#4b6070] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="flex items-start pt-8 w-full">
        <p className="text-xs text-[#9ca3af] text-center w-full">
          Select a date to see available times
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 w-full pr-1">
      {slots.map((slot) => {
        const active = selectedTime === slot
        return (
          <button
            key={slot}
            onClick={() => onSelect(slot)}
            className={[
              'w-full rounded-lg border py-3 text-sm font-medium transition-colors',
              active
                ? 'border-[#4b6070] bg-[#4b6070] text-white'
                : 'border-[#c5ccd4] bg-white text-[#4a7fa8] hover:border-[#4b6070] hover:bg-[#4b6070]/5',
            ].join(' ')}
          >
            {formatTime12(slot)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Booking form (step 2) ────────────────────────────────────────────────────

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
    <div className="flex-1 px-10 py-10">
      <h2 className="text-lg font-bold text-[#1a2535] mb-6">Your details</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-[420px]">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#4a5568] mb-1.5">
              First name <span className="text-red-500">*</span>
            </label>
            <input required className={INPUT} value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4a5568] mb-1.5">
              Last name <span className="text-red-500">*</span>
            </label>
            <input required className={INPUT} value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#4a5568] mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input required type="email" className={INPUT} value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#4a5568] mb-1.5">
            Phone <span className="text-red-500">*</span>
          </label>
          <input required type="tel" className={INPUT} value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#4a5568] mb-1.5">
            Notes <span className="text-[#9ca3af]">(optional)</span>
          </label>
          <textarea rows={3} className={INPUT + ' resize-none'} value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[#4b6070] hover:bg-[#3a4f60] text-white text-sm font-semibold py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Confirming…' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  )
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessCard({
  config,
  event,
  onReset,
}: {
  config: CalendarConfig
  event: BookedEvent
  onReset: () => void
}) {
  const startDate = new Date(event.startTime)
  const dateLabel = format(startDate, 'EEEE, MMMM d, yyyy')
  const timeLabel = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(config.name)}` +
    `&dates=${formatGoogleDate(event.startTime)}/${formatGoogleDate(event.endTime)}`

  return (
    <div className="flex-1 px-10 py-10 flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#1a2535] mb-1">Booking Confirmed!</h2>
      <p className="text-sm text-[#6b7d8e] mb-6">A confirmation email has been sent.</p>
      <div className="w-full max-w-xs bg-[#e0e4e8] rounded-xl p-4 text-left space-y-1.5 mb-6">
        <p className="text-sm font-semibold text-[#1a2535]">{config.name}</p>
        <p className="text-sm text-[#4a5568]">{dateLabel}</p>
        <p className="text-sm text-[#4a5568]">{timeLabel}</p>
        <p className="text-xs text-[#9ca3af]">{config.duration} minutes</p>
      </div>
      {config.confirmationMessage && (
        <p className="text-sm text-[#4a5568] bg-[#e0e4e8] rounded-xl p-4 mb-6 text-left w-full max-w-xs">
          {config.confirmationMessage}
        </p>
      )}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center border border-[#4b6070] text-[#4b6070] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#4b6070]/5 transition-colors"
        >
          Add to Google Calendar
        </a>
        <button onClick={onReset}
          className="w-full text-sm text-[#9ca3af] hover:text-[#6b7d8e] py-2 transition-colors">
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

  const timezone = getBrowserTimezone()

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
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[#4b6070] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (configNotFound || !config) {
    return (
      <div className="text-center py-20">
        <p className="text-[#9ca3af] text-sm">This booking page could not be found.</p>
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-screen bg-[#e8ebee] flex">
      {/* Left panel */}
      <LeftPanel
        config={config}
        selectedDate={selectedDate}
        selectedTime={view === 'form' ? selectedTime : ''}
        onBack={view === 'form' ? () => { setView('picker'); setSelectedTime('') } : undefined}
      />

      {/* Right panel */}
      {view === 'picker' && (
        <div className="flex-1 flex flex-col px-10 py-10">
          <h2 className="text-lg font-bold text-[#1a2535] mb-7">Select Date &amp; Time</h2>

          <div className="flex gap-0 items-start">
            {/* Calendar */}
            <div className="shrink-0">
              <Calendar
                selectedDate={selectedDate}
                onDateClick={handleDateClick}
                loadingDate={loadingDate}
              />
            </div>

            {/* Divider */}
            <div className="w-px bg-[#d1d5db] mx-8" style={{ minHeight: '360px' }} />

            {/* Time slots */}
            <div className="flex-1 max-w-[220px]">
              {noSlots && !slotsLoading && (
                <p className="text-xs text-red-400 mb-3">No times available on this date.</p>
              )}
              <TimeSlots
                slots={slots}
                selectedTime={selectedTime}
                loading={slotsLoading}
                onSelect={handleTimeSelect}
              />
            </div>
          </div>

          {/* Timezone */}
          <div className="mt-8">
            <p className="text-xs font-semibold text-[#4a5568] mb-1.5">Time zone</p>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#9ca3af] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="text-sm text-[#4a5568]">{timezone}</span>
              <svg className="h-3.5 w-3.5 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
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
        <SuccessCard config={config} event={booked} onReset={handleReset} />
      )}
    </div>
  )
}
