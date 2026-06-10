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
  const m = mStr
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${period}`
}

function toDateISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function formatGoogleDate(iso: string): string {
  // Converts ISO string → YYYYMMDDTHHmmssZ
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps: Array<{ n: 1 | 2 | 3; label: string }> = [
    { n: 1, label: 'Date' },
    { n: 2, label: 'Time' },
    { n: 3, label: 'Details' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map(({ n, label }, idx) => (
        <div key={n} className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
              step === n
                ? 'bg-[#0D1B2A] text-white'
                : step > n
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {n} · {label}
          </span>
          {idx < steps.length - 1 && (
            <span className="text-gray-300 text-xs">›</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-8 w-8 rounded-full border-2 border-[#0D1B2A] border-t-transparent animate-spin" />
    </div>
  )
}

// ─── Step 1: Date picker ──────────────────────────────────────────────────────

function DatePicker({
  calId,
  onSelect,
}: {
  calId: string
  onSelect: (date: string, slots: string[]) => void
}) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [noSlots, setNoSlots] = useState(false)

  const calendarStart = startOfWeek(startOfMonth(viewMonth))
  const calendarEnd = endOfWeek(endOfMonth(viewMonth))
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    viewMonth.getMonth() > today.getMonth()

  async function handleDateClick(day: Date) {
    if (isBefore(day, today) && !isToday(day)) return
    setSelectedDate(day)
    setNoSlots(false)
    setLoading(true)
    try {
      const iso = toDateISO(day)
      const res = await fetch(`/api/calendar/availability?calId=${calId}&date=${iso}`)
      const data: { available: boolean; slots: string[] } = await res.json()
      if (data.available && data.slots.length > 0) {
        onSelect(iso, data.slots)
      } else {
        setNoSlots(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          disabled={!canGoPrev}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700"
        >
          ‹ Prev
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
        >
          Next ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isPast = isBefore(day, today) && !isToday(day)
          const isOutside = !isSameMonth(day, viewMonth)
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const isTodayDay = isToday(day)

          return (
            <button
              key={day.toString()}
              disabled={isPast || isOutside}
              onClick={() => handleDateClick(day)}
              className={`
                rounded-lg px-2 py-2 text-sm text-center transition-colors
                ${isOutside ? 'invisible' : ''}
                ${isPast ? 'opacity-30 cursor-not-allowed text-gray-400' : 'cursor-pointer'}
                ${isSelected
                  ? 'bg-[#0D1B2A] text-white'
                  : isTodayDay
                  ? 'ring-2 ring-[#415A77] text-gray-900 hover:bg-[#415A77]/10'
                  : !isPast && !isOutside
                  ? 'text-gray-700 hover:bg-[#415A77]/10'
                  : 'text-gray-400'
                }
              `}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Checking availability…
        </div>
      )}

      {noSlots && !loading && (
        <div className="mt-4 text-center text-sm text-red-500">
          No available times on this date. Please try another day.
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Time slot selection ──────────────────────────────────────────────

function TimeSelector({
  slots,
  selectedDate,
  onSelect,
  onBack,
}: {
  slots: string[]
  selectedDate: string
  onSelect: (time: string) => void
  onBack: () => void
}) {
  const dateLabel = format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d')

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Back
        </button>
        <h3 className="text-sm font-semibold text-gray-900">{dateLabel}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <button
            key={slot}
            onClick={() => onSelect(slot)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:border-[#415A77] hover:bg-[#415A77]/5 transition-colors text-center"
          >
            {formatTime12(slot)}
          </button>
        ))}
      </div>
      {slots.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No slots available.</p>
      )}
    </div>
  )
}

// ─── Step 3: Contact form ─────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

function BookingForm({
  config,
  selectedDate,
  selectedTime,
  onBack,
  onBooked,
}: {
  config: CalendarConfig
  selectedDate: string
  selectedTime: string
  onBack: () => void
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

  const dateLabel = format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
  const timeLabel = formatTime12(selectedTime)

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
    <div>
      {/* Summary */}
      <div className="bg-[#0D1B2A]/5 rounded-xl p-4 mb-5 space-y-1">
        <p className="text-sm font-semibold text-gray-900">{config.name}</p>
        <p className="text-sm text-gray-600">{dateLabel} at {timeLabel}</p>
        <p className="text-xs text-gray-400">{config.duration} minutes</p>
      </div>

      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-800 mb-4 block transition-colors"
      >
        ← Back
      </button>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className={INPUT_CLASS}
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className={INPUT_CLASS}
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            className={INPUT_CLASS}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="tel"
            className={INPUT_CLASS}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            rows={3}
            className={INPUT_CLASS + ' resize-none'}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#0D1B2A] hover:bg-[#415A77] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Confirming…' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

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
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Booking Confirmed!</h2>
      <p className="text-sm text-gray-500 mb-5">You&apos;re all set. A confirmation email has been sent.</p>

      <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-5">
        <p className="text-sm font-semibold text-gray-900">{config.name}</p>
        <p className="text-sm text-gray-600">{dateLabel}</p>
        <p className="text-sm text-gray-600">{timeLabel}</p>
        <p className="text-xs text-gray-400">{config.duration} minutes</p>
      </div>

      {config.confirmationMessage && (
        <p className="text-sm text-gray-600 mb-5 bg-blue-50 rounded-xl p-4 text-left">
          {config.confirmationMessage}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full border border-[#0D1B2A] text-[#0D1B2A] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#0D1B2A]/5 transition-colors"
        >
          Add to Google Calendar
        </a>
        <button
          onClick={onReset}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
        >
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

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [slots, setSlots] = useState<string[]>([])
  const [booked, setBooked] = useState<BookedEvent | null>(null)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/calendar/by-slug/${slug}`)
        if (!res.ok) {
          setConfigNotFound(true)
          return
        }
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

  const handleDateSelect = useCallback((date: string, availableSlots: string[]) => {
    setSelectedDate(date)
    setSlots(availableSlots)
    setStep(2)
  }, [])

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time)
    setStep(3)
  }, [])

  const handleBooked = useCallback((event: BookedEvent) => {
    setBooked(event)
  }, [])

  function handleReset() {
    setStep(1)
    setSelectedDate('')
    setSelectedTime('')
    setSlots([])
    setBooked(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (configLoading) {
    return (
      <div className="max-w-md mx-auto">
        <Spinner />
      </div>
    )
  }

  if (configNotFound || !config) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-gray-500 text-sm">This booking page could not be found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Calendar name */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-900">{config.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{config.duration} min · {config.timezone}</p>
        </div>

        {booked ? (
          <SuccessCard config={config} event={booked} onReset={handleReset} />
        ) : (
          <>
            <StepIndicator step={step} />

            {step === 1 && (
              <DatePicker calId={config.id} onSelect={handleDateSelect} />
            )}

            {step === 2 && (
              <TimeSelector
                slots={slots}
                selectedDate={selectedDate}
                onSelect={handleTimeSelect}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <BookingForm
                config={config}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onBack={() => setStep(2)}
                onBooked={handleBooked}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
