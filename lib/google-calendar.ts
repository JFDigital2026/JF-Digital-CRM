import { prisma } from '@/lib/prisma'

interface GCalConfig {
  id: string
  googleAccessToken: string | null
  googleRefreshToken: string | null
  timezone: string
}

async function doRefresh(configId: string, refreshToken: string): Promise<string | null> {
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
  await prisma.calendarConfig.update({
    where: { id: configId },
    data: { googleAccessToken: data.access_token },
  })
  return data.access_token
}

async function getToken(config: GCalConfig): Promise<string | null> {
  if (config.googleAccessToken) return config.googleAccessToken
  if (config.googleRefreshToken) return doRefresh(config.id, config.googleRefreshToken)
  return null
}

async function fetchWithRefresh(
  config: GCalConfig,
  url: string,
  init: RequestInit,
  currentToken: string
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers as Record<string, string>, Authorization: `Bearer ${currentToken}` },
  })
  if (res.status !== 401 || !config.googleRefreshToken) return res

  const newToken = await doRefresh(config.id, config.googleRefreshToken)
  if (!newToken) return res

  return fetch(url, {
    ...init,
    headers: { ...init.headers as Record<string, string>, Authorization: `Bearer ${newToken}` },
  })
}

export async function createGoogleCalendarEvent(
  config: GCalConfig,
  event: {
    title: string
    startTime: Date
    endTime: Date
    notes?: string | null
    attendeeEmail?: string | null
    attendeeName?: string | null
    zoomJoinUrl?: string | null
  }
): Promise<string | null> {
  const token = await getToken(config)
  if (!token) return null

  const descParts = [event.notes, event.zoomJoinUrl ? `Zoom: ${event.zoomJoinUrl}` : null].filter(Boolean)
  const body = {
    summary: event.title,
    ...(descParts.length ? { description: descParts.join('\n') } : {}),
    start: { dateTime: event.startTime.toISOString(), timeZone: config.timezone },
    end: { dateTime: event.endTime.toISOString(), timeZone: config.timezone },
    ...(event.attendeeEmail ? {
      attendees: [{ email: event.attendeeEmail, displayName: event.attendeeName ?? undefined }],
      guestsCanModifyEvent: false,
    } : {}),
  }

  const res = await fetchWithRefresh(
    config,
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  )

  if (!res.ok) return null
  const data = await res.json() as { id?: string }
  return data.id ?? null
}

export async function deleteGoogleCalendarEvent(
  config: GCalConfig,
  googleEventId: string
): Promise<void> {
  const token = await getToken(config)
  if (!token) return

  const res = await fetchWithRefresh(
    config,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    { method: 'DELETE' },
    token
  )
  // 204 = deleted, 404 = already gone — both fine
  void res
}
