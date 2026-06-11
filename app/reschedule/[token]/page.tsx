'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type EventInfo = {
  title: string
  startTime: string
  calName: string
  calSlug: string
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
      <div style={page}>
        <div style={card}>
          <p style={sub}>Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={page}>
        <div style={card}>
          <p style={heading}>Link unavailable</p>
          <p style={sub}>{error}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={page}>
        <div style={card}>
          <p style={heading}>Appointment cancelled.</p>
          <p style={sub}>Taking you to book a new time…</p>
        </div>
      </div>
    )
  }

  const dt = info ? new Date(info.startTime) : null
  const dateDisplay = dt?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeDisplay = dt?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={page}>
      <div style={card}>
        <p style={label}>Reschedule</p>
        <p style={heading}>{info?.calName}</p>
        <p style={sub}>{dateDisplay} at {timeDisplay}</p>

        <p style={{ margin: '24px 0', color: '#4b5563', fontSize: 14, lineHeight: 1.6 }}>
          Clicking below will cancel this appointment and open the booking page so you can pick a new time.
        </p>

        <button
          onClick={handleCancel}
          disabled={cancelling}
          style={{
            background: '#0D1B2A',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 600,
            cursor: cancelling ? 'not-allowed' : 'pointer',
            opacity: cancelling ? 0.7 : 1,
            width: '100%',
          }}
        >
          {cancelling ? 'Cancelling…' : 'Cancel & Pick a New Time'}
        </button>
      </div>
    </div>
  )
}

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f3f4f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: '40px 36px',
  maxWidth: 420,
  width: '100%',
  boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
}

const label: React.CSSProperties = {
  margin: '0 0 6px',
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
}

const heading: React.CSSProperties = {
  margin: '0 0 4px',
  color: '#0D1B2A',
  fontSize: 22,
  fontWeight: 700,
}

const sub: React.CSSProperties = {
  margin: 0,
  color: '#6b7280',
  fontSize: 14,
}
