import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createRescheduleToken } from '@/lib/reschedule-token'

const WINDOW_MS = 10 * 60 * 1000 // ±10 min window

function extractZoomUrl(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/^Zoom: (https?:\/\/\S+)$/m)
  return match ? match[1] : null
}

function formatET(date: Date) {
  const dateDisplay = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timeDisplay =
    date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' ET'
  return { dateDisplay, timeDisplay }
}

function build24hHtml(firstName: string, dateDisplay: string, timeDisplay: string, zoomUrl: string | null, rescheduleUrl: string) {
  const zoomLine = zoomUrl
    ? `<p style="margin:0 0 6px;color:#111827;font-size:15px;">📞 <a href="${zoomUrl}" style="color:#1d4ed8;">${zoomUrl}</a></p>`
    : `<p style="margin:0 0 6px;color:#111827;font-size:15px;">📞 Details to follow</p>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#415A77;padding:28px 32px;">
            <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">JF Digital</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 20px;color:#111827;font-size:16px;">Hey ${firstName},</p>
            <p style="margin:0 0 24px;color:#111827;font-size:16px;">Just a reminder that we're talking tomorrow.</p>

            <div style="background:#f9fafb;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
              <p style="margin:0 0 6px;color:#111827;font-size:15px;">📅 ${dateDisplay}</p>
              <p style="margin:0 0 6px;color:#111827;font-size:15px;">🕐 ${timeDisplay}</p>
              ${zoomLine}
            </div>

            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">Come ready to talk through how your business runs — that's all the prep you need.</p>

            <p style="margin:0 0 32px;"><a href="${rescheduleUrl}" style="color:#6b7280;font-size:14px;">Need to reschedule?</a></p>

            <p style="margin:0;color:#374151;font-size:15px;">See you tomorrow,<br><strong>Jace</strong><br>JF Digital</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function build1hHtml(firstName: string, dateDisplay: string, timeDisplay: string, zoomUrl: string | null) {
  const zoomLine = zoomUrl
    ? `<p style="margin:0 0 6px;color:#111827;font-size:15px;">📞 <a href="${zoomUrl}" style="color:#1d4ed8;">${zoomUrl}</a></p>`
    : `<p style="margin:0 0 6px;color:#111827;font-size:15px;">📞 Details to follow</p>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#415A77;padding:28px 32px;">
            <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">JF Digital</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 20px;color:#111827;font-size:16px;">Hey ${firstName},</p>
            <p style="margin:0 0 24px;color:#111827;font-size:16px;">We're on in one hour.</p>

            <div style="background:#f9fafb;border-radius:8px;padding:20px 24px;margin:0 0 32px;">
              <p style="margin:0 0 6px;color:#111827;font-size:15px;">📅 ${dateDisplay}</p>
              <p style="margin:0 0 6px;color:#111827;font-size:15px;">🕐 ${timeDisplay}</p>
              ${zoomLine}
            </div>

            <p style="margin:0;color:#374151;font-size:15px;">See you soon,<br><strong>Jace</strong><br>JF Digital</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL ?? 'bookings@jf-digital.com'
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://book.jf-digital.com'
  const now = new Date()
  let sent = 0
  let errors = 0

  // ── 24h reminders ──────────────────────────────────────────────────────────
  const target24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const events24h = await prisma.calendarEvent.findMany({
    where: {
      status: 'CONFIRMED',
      reminder24hSent: false,
      startTime: {
        gte: new Date(target24h.getTime() - WINDOW_MS),
        lte: new Date(target24h.getTime() + WINDOW_MS),
      },
    },
    include: {
      contact: true,
      calendarConfig: { select: { reminderTiming: true, slug: true } },
    },
  })

  for (const event of events24h) {
    if (!event.calendarConfig.reminderTiming.includes('24h')) continue
    const email = event.contact?.email
    const firstName = event.contact?.firstName ?? event.title.split(' ')[0]
    if (!email) continue

    const zoomUrl = extractZoomUrl(event.notes)
    const { dateDisplay, timeDisplay } = formatET(event.startTime)
    const rescheduleToken = createRescheduleToken(event.id, event.calendarConfig.slug)
    const rescheduleUrl = `${baseUrl}/reschedule/${rescheduleToken}`

    try {
      await resend.emails.send({
        from,
        to: email,
        subject: `Reminder: we're talking tomorrow`,
        html: build24hHtml(firstName, dateDisplay, timeDisplay, zoomUrl, rescheduleUrl),
      })
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { reminder24hSent: true },
      })
      sent++
    } catch {
      errors++
    }
  }

  // ── 1h reminders ───────────────────────────────────────────────────────────
  const target1h = new Date(now.getTime() + 60 * 60 * 1000)
  const events1h = await prisma.calendarEvent.findMany({
    where: {
      status: 'CONFIRMED',
      reminder1hSent: false,
      startTime: {
        gte: new Date(target1h.getTime() - WINDOW_MS),
        lte: new Date(target1h.getTime() + WINDOW_MS),
      },
    },
    include: {
      contact: true,
      calendarConfig: { select: { reminderTiming: true, slug: true } },
    },
  })

  for (const event of events1h) {
    if (!event.calendarConfig.reminderTiming.includes('1h')) continue
    const email = event.contact?.email
    const firstName = event.contact?.firstName ?? event.title.split(' ')[0]
    if (!email) continue

    const zoomUrl = extractZoomUrl(event.notes)
    const { dateDisplay, timeDisplay } = formatET(event.startTime)

    try {
      await resend.emails.send({
        from,
        to: email,
        subject: `We're on in one hour`,
        html: build1hHtml(firstName, dateDisplay, timeDisplay, zoomUrl),
      })
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { reminder1hSent: true },
      })
      sent++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ sent, errors, checkedAt: now.toISOString() })
}
