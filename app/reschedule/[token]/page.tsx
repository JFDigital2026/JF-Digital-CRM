'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type EventInfo = {
  title: string
  startTime: string
  calName: string
  calSlug: string
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="jf-card jf-rise px-8 py-10 sm:px-10">{children}</div>
        <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.26em] text-[var(--jf-t22)]">
          JF Digital
        </p>
      </div>
    </div>
  )
}

function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/jf-digital-logo.png" alt="JF Digital" className="mb-6 h-9 w-auto object-contain" />
  )
}

export default function ReschedulePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [info, setInfo] = useState<EventInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/calendar/reschedule/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setInfo(d)
      })
      .catch(() => setError('Something went wrong.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleCancel() {
    setCancelling(true)
    const res = await fetch(`/api/calendar/reschedule/${token}`, { method: 'POST' })
    const data = await res.json()
    if (data.success || res.status === 410) {
      setDone(true)
      setTimeout(() => router.push(`/book/${data.calSlug ?? info?.calSlug ?? ''}`), 2000)
    } else {
      setError(data.error ?? 'Cancellation failed.')
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(92,80,63,0.5)] border-t-[var(--jf-gold)]" />
          <p className="text-[13px] text-[var(--jf-t55)]">Loading…</p>
        </div>
      </Shell>
    )
  }

  if (error) {
    return (
      <Shell>
        <Logo />
        <h1 className="jf-display mb-2 text-[26px] text-[var(--jf-t100)]">
          Link <span className="jf-accent">unavailable</span>.
        </h1>
        <p className="text-[13px] leading-relaxed text-[var(--jf-t55)]">{error}</p>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(189,157,98,0.35)] bg-[var(--jf-fill)] shadow-[0_0_40px_rgba(189,157,98,0.14)]">
          <svg className="h-5 w-5 text-[var(--jf-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="jf-display mb-2 text-[26px] text-[var(--jf-t100)]">
          Appointment <span className="jf-accent">cancelled</span>.
        </h1>
        <p className="text-[13px] text-[var(--jf-t55)]">Taking you to book a new time…</p>
      </Shell>
    )
  }

  const dt = info ? new Date(info.startTime) : null
  const dateDisplay = dt?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeDisplay = dt?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <Shell>
      <Logo />
      <p className="jf-eyebrow mb-3">Reschedule</p>
      <h1 className="jf-display text-[26px] leading-[1.15] text-[var(--jf-t100)]">{info?.calName}</h1>

      <div className="my-6 h-px w-full bg-[var(--jf-line-soft)]" />

      <div className="flex items-center gap-2.5">
        <svg className="h-4 w-4 shrink-0 text-[var(--jf-t38)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="text-[13px] text-[var(--jf-t80)]">
          {dateDisplay} at {timeDisplay}
        </span>
      </div>

      <p className="my-7 text-[13px] leading-relaxed text-[var(--jf-t55)]">
        Continuing will cancel this appointment and open the booking page so you can pick a new time.
      </p>

      <button onClick={handleCancel} disabled={cancelling} className="jf-btn">
        <span className="jf-btn-shimmer" />
        {cancelling ? 'Cancelling…' : 'Cancel & Pick a New Time'}
      </button>
    </Shell>
  )
}
