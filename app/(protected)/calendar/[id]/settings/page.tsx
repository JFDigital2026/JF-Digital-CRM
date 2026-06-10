'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Copy, Trash2 } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type DayAvailability = { enabled: boolean; start: string; end: string }
type AvailabilityJson = Record<string, DayAvailability>
type MeetingLocationEntry = { userId: string; name: string; priority: string; location: string }

type CalendarConfig = {
  id: string
  name: string
  type: string
  description?: string | null
  slug: string
  duration: number
  bufferTime: number
  timezone: string
  active: boolean
  roundRobin: boolean
  confirmationMessage?: string | null
  reminderTiming: string[]
  availabilityJson: AvailabilityJson
  maxBookingsPerDay?: number | null
  googleConnectedEmail?: string | null
  googleSyncDirection?: string | null
  meetingInterval?: number | null
  meetingIntervalUnit?: string | null
  minSchedulingNotice?: number | null
  minSchedulingNoticeUnit?: string | null
  dateRange?: number | null
  dateRangeUnit?: string | null
  preBufferTime?: number | null
  maxBookingsPerSlot?: number | null
  lookBusy?: boolean | null
  lookBusyPercent?: number | null
  meetingDistribution?: string | null
  meetingLocations?: MeetingLocationEntry[] | null
  meetingInviteTitle?: string | null
  meetingColor?: string | null
  group?: string | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CALENDAR_TYPES = [
  'Discovery Call',
  'Strategy Call',
  'Closing Call',
  'Implementation Call',
  'Custom',
]

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
]

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const MEETING_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
]

const DEFAULT_AVAILABILITY: AvailabilityJson = Object.fromEntries(
  DAYS_OF_WEEK.map((day) => [
    day,
    { enabled: !['Saturday', 'Sunday'].includes(day), start: '09:00', end: '17:00' },
  ])
)

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

const cardClass = 'rounded-xl border border-gray-100 bg-white p-6 shadow-sm mb-4'

// ─── Helper Components ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-[#0D1B2A]' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  )
}

function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-3 py-2 text-gray-500 hover:bg-gray-50 border-r border-gray-200"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-16 px-2 py-2 text-sm text-center outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-3 py-2 text-gray-500 hover:bg-gray-50 border-l border-gray-200"
      >
        +
      </button>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className={cardClass}>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 mb-4 last:mb-0', className)}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Toast({
  message,
  type = 'success',
}: {
  message: string
  type?: 'success' | 'error'
}) {
  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg transition-all',
        type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
      )}
    >
      {message}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarSettingsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localConfig, setLocalConfig] = useState<CalendarConfig | null>(null)
  const [copied, setCopied] = useState(false)

  const update = useCallback(
    <K extends keyof CalendarConfig>(key: K, value: CalendarConfig[K]) => {
      setLocalConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    []
  )

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true)
      try {
        const res = await fetch(`/api/calendar/${id}`)
        if (res.ok) {
          const data: CalendarConfig = await res.json()
          data.availabilityJson = {
            ...DEFAULT_AVAILABILITY,
            ...(data.availabilityJson ?? {}),
          }
          data.reminderTiming = data.reminderTiming ?? []
          setLocalConfig(data)
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchConfig()
  }, [id])

  // TipTap editor — initialized once localConfig loads
  const editor = useEditor({
    extensions: [StarterKit],
    content: localConfig?.description ?? '',
    onUpdate: ({ editor: ed }) => {
      setLocalConfig((prev) => (prev ? { ...prev, description: ed.getHTML() } : prev))
    },
  })

  // Sync editor content when localConfig first loads
  useEffect(() => {
    if (editor && localConfig?.description !== undefined && editor.isEmpty) {
      editor.commands.setContent(localConfig.description ?? '')
    }
  }, [editor, localConfig?.description])

  const handleSave = async () => {
    if (!localConfig) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig),
      })
      if (res.ok) {
        showToast('Settings saved successfully.')
      } else {
        showToast('Failed to save settings.', 'error')
      }
    } catch {
      showToast('An unexpected error occurred.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!localConfig) return
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleConnectedEmail: null,
        googleAccessToken: null,
        googleRefreshToken: null,
      }),
    })
    if (res.ok) {
      update('googleConnectedEmail', null)
      update('googleSyncDirection', null)
      showToast('Google Calendar disconnected.')
    } else {
      showToast('Failed to disconnect.', 'error')
    }
  }

  const updateAvailabilityDay = (
    day: string,
    field: keyof DayAvailability,
    value: boolean | string
  ) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        availabilityJson: {
          ...prev.availabilityJson,
          [day]: { ...prev.availabilityJson[day], [field]: value },
        },
      }
    })
  }

  const toggleReminderTiming = (value: string) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      const current = prev.reminderTiming ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, reminderTiming: next }
    })
  }

  const bookingPreviewUrl =
    typeof window !== 'undefined' && localConfig
      ? `${window.location.origin}/book/${localConfig.slug}`
      : localConfig
      ? `/book/${localConfig.slug}`
      : ''

  const handleCopyUrl = () => {
    if (!bookingPreviewUrl) return
    navigator.clipboard.writeText(bookingPreviewUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addMeetingLocation = () => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      const entry: MeetingLocationEntry = {
        userId: 'primary',
        name: 'You',
        priority: 'medium',
        location: 'Zoom',
      }
      return { ...prev, meetingLocations: [...(prev.meetingLocations ?? []), entry] }
    })
  }

  const updateMeetingLocation = (
    index: number,
    field: keyof MeetingLocationEntry,
    value: string
  ) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      const updated = (prev.meetingLocations ?? []).map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
      return { ...prev, meetingLocations: updated }
    })
  }

  const removeMeetingLocation = (index: number) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        meetingLocations: (prev.meetingLocations ?? []).filter((_, i) => i !== index),
      }
    })
  }

  if (loading) {
    return (
      <div className="px-6 py-6 max-w-3xl">
        <LoadingSkeleton variant="list" rows={6} />
      </div>
    )
  }

  if (!localConfig) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-gray-500">Calendar not found.</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-3xl">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/calendar')}
            className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Calendar
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {localConfig.name} — Settings
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-7 shrink-0 rounded-lg bg-[#0D1B2A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Section 1: Event Details ── */}
      <Section
        title="Event Details"
        subtitle="Basic information about this calendar."
      >
        {/* Calendar Name */}
        <Field label="Calendar Name">
          <input
            className={inputClass}
            value={localConfig.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>

        {/* Description — TipTap */}
        <Field label="Description">
          <div className="rounded-md border border-gray-200 p-3 min-h-[120px] focus-within:border-[#415A77] focus-within:ring-2 focus-within:ring-[#415A77]/20 transition-colors">
            {editor && (
              <div className="flex gap-1 border-b border-gray-200 pb-2 mb-2">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-bold',
                    editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'
                  )}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn(
                    'rounded px-2 py-1 text-xs italic',
                    editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'
                  )}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={cn(
                    'rounded px-2 py-1 text-xs',
                    editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'
                  )}
                >
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={cn(
                    'rounded px-2 py-1 text-xs',
                    editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'
                  )}
                >
                  1. List
                </button>
              </div>
            )}
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none outline-none"
            />
          </div>
        </Field>

        {/* Meeting Invite Title */}
        <Field
          label="Meeting Invite Title"
          hint="Merge tags: {{contact.name}}, {{calendar.name}}"
        >
          <input
            className={inputClass}
            value={localConfig.meetingInviteTitle ?? ''}
            onChange={(e) => update('meetingInviteTitle', e.target.value || null)}
            placeholder="e.g. Meeting with {{contact.name}}"
          />
        </Field>

        {/* Meeting Color */}
        <Field label="Meeting Color">
          <div className="flex items-center gap-2 flex-wrap">
            {MEETING_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => update('meetingColor', color)}
                style={{ backgroundColor: color }}
                className={cn(
                  'h-10 w-10 rounded-full transition-all',
                  localConfig.meetingColor === color
                    ? 'ring-2 ring-offset-2 ring-gray-700'
                    : 'hover:scale-110'
                )}
              />
            ))}
          </div>
        </Field>

        {/* Booking URL */}
        <Field label="Booking URL">
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
            <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0 select-none">
              /book/
            </span>
            <input
              className="flex-1 px-3 py-2 text-sm text-gray-900 outline-none"
              value={localConfig.slug}
              onChange={(e) => update('slug', e.target.value)}
              placeholder="my-calendar"
            />
          </div>
          {bookingPreviewUrl && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-400 truncate">{bookingPreviewUrl}</span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="shrink-0 flex items-center gap-1 rounded px-2 py-0.5 text-xs text-[#415A77] hover:bg-[#415A77]/5 transition-colors"
              >
                <Copy size={12} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </Field>

        {/* Type */}
        <Field label="Type">
          <select
            className={inputClass}
            value={localConfig.type}
            onChange={(e) => update('type', e.target.value)}
          >
            {CALENDAR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        {/* Active */}
        <div className="flex items-center gap-3 pt-1">
          <Toggle
            checked={localConfig.active}
            onChange={(v) => update('active', v)}
            label={localConfig.active ? 'Active — accepting bookings' : 'Inactive — not accepting bookings'}
          />
        </div>
      </Section>

      {/* ── Section 2: Availability ── */}
      <Section
        title="Availability"
        subtitle="Set when you're available for meetings."
      >
        {/* Timezone */}
        <Field label="Timezone">
          <select
            className={inputClass}
            value={localConfig.timezone}
            onChange={(e) => update('timezone', e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>

        {/* Per-day rows */}
        <div className="flex flex-col gap-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayConfig = localConfig.availabilityJson[day] ?? {
              enabled: false,
              start: '09:00',
              end: '17:00',
            }
            return (
              <div key={day} className="flex items-center gap-3">
                <Toggle
                  checked={dayConfig.enabled}
                  onChange={(v) => updateAvailabilityDay(day, 'enabled', v)}
                />
                <span
                  className={cn(
                    'w-24 shrink-0 text-sm font-medium',
                    dayConfig.enabled ? 'text-gray-800' : 'text-gray-400'
                  )}
                >
                  {day}
                </span>
                {dayConfig.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={dayConfig.start}
                      onChange={(e) => updateAvailabilityDay(day, 'start', e.target.value)}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                      type="time"
                      value={dayConfig.end}
                      onChange={(e) => updateAvailabilityDay(day, 'end', e.target.value)}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Unavailable</span>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Section 3: Booking Rules ── */}
      <Section
        title="Booking Rules"
        subtitle="Control how and when meetings can be booked."
      >
        {/* Row 1: Meeting Interval + Meeting Duration */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Meeting Interval" hint="How often a new slot starts" className="mb-0">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className={cn(inputClass, 'flex-1')}
                value={localConfig.meetingInterval ?? 30}
                onChange={(e) =>
                  update('meetingInterval', e.target.value ? Number(e.target.value) : null)
                }
              />
              <select
                className="rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
                value={localConfig.meetingIntervalUnit ?? 'minutes'}
                onChange={(e) => update('meetingIntervalUnit', e.target.value)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </Field>

          <Field label="Meeting Duration" hint="Length of each meeting" className="mb-0">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className={cn(inputClass, 'flex-1')}
                value={localConfig.duration}
                onChange={(e) =>
                  update('duration', e.target.value ? Number(e.target.value) : 30)
                }
              />
              <select
                className="rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </Field>
        </div>

        {/* Row 2: Min Scheduling Notice + Date Range */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field
            label="Minimum Scheduling Notice"
            hint="How far in advance someone can book"
            className="mb-0"
          >
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                className={cn(inputClass, 'flex-1')}
                value={localConfig.minSchedulingNotice ?? 0}
                onChange={(e) =>
                  update('minSchedulingNotice', e.target.value ? Number(e.target.value) : null)
                }
              />
              <select
                className="rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
                value={localConfig.minSchedulingNoticeUnit ?? 'minutes'}
                onChange={(e) => update('minSchedulingNoticeUnit', e.target.value)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </Field>

          <Field label="Date Range" hint="How far ahead people can book" className="mb-0">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className={cn(inputClass, 'flex-1')}
                value={localConfig.dateRange ?? 60}
                onChange={(e) =>
                  update('dateRange', e.target.value ? Number(e.target.value) : null)
                }
              />
              <select
                className="rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
                value={localConfig.dateRangeUnit ?? 'days'}
                onChange={(e) => update('dateRangeUnit', e.target.value)}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </Field>
        </div>

        {/* Row 3: Pre Buffer + Post Buffer */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Pre Buffer Time" hint="Block time before the meeting" className="mb-0">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                className={cn(inputClass, 'flex-1')}
                value={localConfig.preBufferTime ?? 0}
                onChange={(e) =>
                  update('preBufferTime', e.target.value ? Number(e.target.value) : null)
                }
              />
              <select
                className="rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </Field>

          <Field label="Post Buffer Time" hint="Block time after the meeting" className="mb-0">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                className={cn(inputClass, 'flex-1')}
                value={localConfig.bufferTime}
                onChange={(e) =>
                  update('bufferTime', e.target.value ? Number(e.target.value) : 0)
                }
              />
              <select
                className="rounded-md border border-gray-200 px-2 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </Field>
        </div>

        {/* Row 4: Max Bookings Per Day + Max Bookings Per Slot */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Maximum Bookings Per Day" className="mb-0">
            <NumberStepper
              value={localConfig.maxBookingsPerDay ?? 0}
              onChange={(n) => update('maxBookingsPerDay', n === 0 ? null : n)}
            />
          </Field>

          <Field label="Maximum Bookings Per Slot (per user)" className="mb-0">
            <NumberStepper
              value={localConfig.maxBookingsPerSlot ?? 0}
              onChange={(n) => update('maxBookingsPerSlot', n === 0 ? null : n)}
            />
          </Field>
        </div>

        {/* Look Busy */}
        <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-3 mb-1">
            <Toggle
              checked={!!localConfig.lookBusy}
              onChange={(v) => update('lookBusy', v)}
            />
            <span className="text-sm font-medium text-gray-700">Look Busy</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Hide the number of available slots by x%.
          </p>
          {localConfig.lookBusy && (
            <div className="flex items-center gap-2 mt-3">
              <input
                type="number"
                min={0}
                max={100}
                className="w-20 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors"
                value={localConfig.lookBusyPercent ?? 0}
                onChange={(e) =>
                  update('lookBusyPercent', e.target.value ? Number(e.target.value) : null)
                }
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          )}
        </div>
      </Section>

      {/* ── Section 4: Staff & Meeting Location ── */}
      <Section
        title="Staff & Meeting Location"
        subtitle="Assign staff to this calendar and set where meetings take place."
      >
        {/* Meeting Distribution */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Meeting Distribution</p>
          <div className="flex flex-col gap-3">
            {[
              { value: 'availability', label: 'Optimize for availability' },
              { value: 'equal', label: 'Optimize for equal distribution' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => update('meetingDistribution', value)}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors shrink-0',
                    localConfig.meetingDistribution === value
                      ? 'border-[#0D1B2A]'
                      : 'border-gray-300'
                  )}
                >
                  {localConfig.meetingDistribution === value && (
                    <span className="h-2 w-2 rounded-full bg-[#0D1B2A]" />
                  )}
                </button>
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Meeting Locations */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Meeting Locations</p>
          <div className="flex flex-col gap-2 mb-3">
            {(localConfig.meetingLocations ?? []).map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#415A77] text-xs font-medium text-white">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
                {/* Name */}
                <input
                  className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#415A77] transition-colors bg-white"
                  value={entry.name}
                  onChange={(e) => updateMeetingLocation(i, 'name', e.target.value)}
                />
                {/* Priority */}
                <select
                  className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#415A77] transition-colors bg-white"
                  value={entry.priority}
                  onChange={(e) => updateMeetingLocation(i, 'priority', e.target.value)}
                >
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
                {/* Location */}
                <select
                  className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#415A77] transition-colors bg-white"
                  value={entry.location}
                  onChange={(e) => updateMeetingLocation(i, 'location', e.target.value)}
                >
                  <option value="Zoom">Zoom</option>
                  <option value="Google Meet">Google Meet</option>
                  <option value="Phone">Phone</option>
                  <option value="In Person">In Person</option>
                  <option value="Custom">Custom</option>
                </select>
                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeMeetingLocation(i)}
                  className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMeetingLocation}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            + Add location
          </button>
        </div>
      </Section>

      {/* ── Section 5: Notifications ── */}
      <Section
        title="Notifications"
        subtitle="Configure confirmation and reminder messages."
      >
        {/* Confirmation */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <Toggle
              checked={!!localConfig.confirmationMessage}
              onChange={(v) =>
                update(
                  'confirmationMessage',
                  v ? 'Thank you for booking! We look forward to speaking with you.' : null
                )
              }
              label="Send confirmation email"
            />
          </div>
          {!!localConfig.confirmationMessage && (
            <textarea
              className={inputClass}
              rows={3}
              value={localConfig.confirmationMessage}
              onChange={(e) => update('confirmationMessage', e.target.value || null)}
              placeholder="Enter your confirmation message…"
            />
          )}
        </div>

        {/* Reminders */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Reminder Timing</p>
          <div className="flex flex-col gap-2">
            {[
              { value: '24h', label: '24 hours before' },
              { value: '1h', label: '1 hour before' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-[#415A77] focus:ring-[#415A77]/20 cursor-pointer"
                  checked={(localConfig.reminderTiming ?? []).includes(value)}
                  onChange={() => toggleReminderTiming(value)}
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Section 6: Round Robin ── */}
      <Section
        title="Round Robin"
        subtitle="Distribute bookings across team members."
      >
        <div className="flex items-start gap-3">
          <Toggle
            checked={localConfig.roundRobin}
            onChange={(v) => update('roundRobin', v)}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Enable Round Robin</p>
            <p className="mt-0.5 text-xs text-gray-400">
              When enabled, bookings will be distributed across team members (currently assigns to primary user).
            </p>
          </div>
        </div>
      </Section>

      {/* ── Section 7: Google Calendar Sync ── */}
      <Section
        title="Google Calendar Sync"
        subtitle="Connect your Google Calendar to sync availability."
      >
        {localConfig.googleConnectedEmail ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5">
              <span className="text-sm text-gray-700">
                Connected as{' '}
                <span className="font-medium">{localConfig.googleConnectedEmail}</span>
              </span>
            </div>

            <Field label="Sync Direction">
              <select
                className={inputClass}
                value={localConfig.googleSyncDirection ?? 'read'}
                onChange={(e) => update('googleSyncDirection', e.target.value)}
              >
                <option value="read">Read-only</option>
                <option value="two-way">Two-way</option>
              </select>
            </Field>

            <button
              onClick={handleDisconnectGoogle}
              className="self-start rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Disconnect Google Calendar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                window.location.href = '/api/calendar/google/connect'
              }}
              className="self-start flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Connect Google Calendar
            </button>
            <p className="text-xs text-gray-400">
              Requires{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-gray-600">
                GOOGLE_CLIENT_ID
              </code>{' '}
              to be configured.
            </p>
          </div>
        )}
      </Section>

      {/* Bottom save buffer */}
      <div className="pb-10" />
    </div>
  )
}
