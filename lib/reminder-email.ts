import { prisma } from '@/lib/prisma'
import { createRescheduleToken } from '@/lib/reschedule-token'

// Shared reminder-email rendering + due-query logic, extracted from the legacy
// cron route so the n8n-facing v1 endpoints (reminders/due, reminders/send) can
// reuse the exact same templates and windowing. n8n owns the scheduling + loop;
// the CRM still owns the template and the Resend send.

export type ReminderTiming = '24h' | '1h'

export const REMINDER_WINDOW_MS = 10 * 60 * 1000 // ±10 min match window

const OFFSET_MS: Record<ReminderTiming, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '1h': 60 * 60 * 1000,
}

const SENT_FIELD: Record<ReminderTiming, 'reminder24hSent' | 'reminder1hSent'> = {
  '24h': 'reminder24hSent',
  '1h': 'reminder1hSent',
}

export function isReminderTiming(v: unknown): v is ReminderTiming {
  return v === '24h' || v === '1h'
}

export function extractZoomUrl(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/^Zoom: (https?:\/\/\S+)$/m)
  return match ? match[1] : null
}

export function formatET(date: Date) {
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

type ReminderEvent = {
  id: string
  title: string
  notes: string | null
  startTime: Date
  contact: { firstName: string | null; email: string | null } | null
  calendarConfig: { reminderTiming: string[]; slug: string }
}

/**
 * Events whose start time falls in the ±window around `now + offset(timing)`,
 * are CONFIRMED, opted into this timing, and have not had this reminder sent.
 */
export async function getDueReminders(timing: ReminderTiming, now = new Date()): Promise<ReminderEvent[]> {
  const target = new Date(now.getTime() + OFFSET_MS[timing])
  const events = await prisma.calendarEvent.findMany({
    where: {
      status: 'CONFIRMED',
      [SENT_FIELD[timing]]: false,
      startTime: {
        gte: new Date(target.getTime() - REMINDER_WINDOW_MS),
        lte: new Date(target.getTime() + REMINDER_WINDOW_MS),
      },
    },
    include: {
      contact: { select: { firstName: true, email: true } },
      calendarConfig: { select: { reminderTiming: true, slug: true } },
    },
  })
  return events.filter((e) => e.calendarConfig.reminderTiming.includes(timing))
}

/** Render subject + HTML for a reminder email from a calendar event. */
export function renderReminderEmail(timing: ReminderTiming, event: ReminderEvent, baseUrl: string) {
  const firstName = event.contact?.firstName ?? event.title.split(' ')[0]
  const zoomUrl = extractZoomUrl(event.notes)
  const { dateDisplay, timeDisplay } = formatET(event.startTime)

  if (timing === '24h') {
    const token = createRescheduleToken(event.id, event.calendarConfig.slug)
    const rescheduleUrl = `${baseUrl}/reschedule/${token}`
    return {
      subject: `Reminder: we're talking tomorrow`,
      html: build24hHtml(firstName, dateDisplay, timeDisplay, zoomUrl, rescheduleUrl),
    }
  }
  return {
    subject: `We're on in one hour`,
    html: build1hHtml(firstName, dateDisplay, timeDisplay, zoomUrl),
  }
}

export function markReminderSent(eventId: string, timing: ReminderTiming) {
  return prisma.calendarEvent.update({
    where: { id: eventId },
    data: { [SENT_FIELD[timing]]: true },
  })
}
