import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type GoogleCalendarEvent = {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  colorId?: string
  status?: string
  htmlLink?: string
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    if (!data.access_token) return null
    // Save new access token
    await prisma.user.update({
      where: { id: userId },
      data: { googleAccessToken: data.access_token },
    })
    return data.access_token
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { googleAccessToken: true, googleRefreshToken: true, googleCalendarEmail: true },
  })

  if (!user?.googleAccessToken) {
    return NextResponse.json({ events: [], connected: false })
  }

  const fetchEvents = async (token: string) => {
    const params = new URLSearchParams({
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    })
    return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  let res = await fetchEvents(user.googleAccessToken)

  // If 401, try token refresh
  if (res.status === 401 && user.googleRefreshToken) {
    const newToken = await refreshAccessToken(session.user.id, user.googleRefreshToken)
    if (newToken) {
      res = await fetchEvents(newToken)
    }
  }

  if (!res.ok) {
    return NextResponse.json({ events: [], connected: true, error: 'Failed to fetch events' })
  }

  const data = await res.json() as { items?: GoogleCalendarEvent[] }

  const events = (data.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      id: e.id,
      title: e.summary ?? '(No title)',
      start: e.start.dateTime ?? e.start.date ?? '',
      end: e.end.dateTime ?? e.end.date ?? '',
      colorId: e.colorId ?? null,
      isAllDay: !e.start.dateTime,
      source: 'google' as const,
      htmlLink: e.htmlLink,
    }))

  return NextResponse.json({ events, connected: true, email: user.googleCalendarEmail })
}
