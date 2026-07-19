import { Resend } from 'resend'
import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'
import {
  isReminderTiming,
  renderReminderEmail,
  markReminderSent,
} from '@/lib/reminder-email'

// POST /api/v1/reminders/send  { eventId, timing }
// Renders the CRM reminder template, sends via Resend, and marks the reminder
// sent — atomically enough that n8n retries are idempotent (a re-send request
// for an already-sent reminder short-circuits before emailing).
export async function POST(req: Request) {
  const auth = await requireAuth(req, 'calendar:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { eventId, timing } = body

  if (!eventId || typeof eventId !== 'string') {
    return err('VALIDATION_ERROR', 'eventId is required')
  }
  if (!isReminderTiming(timing)) {
    return err('VALIDATION_ERROR', "timing must be '24h' or '1h'")
  }

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      contact: { select: { firstName: true, email: true } },
      calendarConfig: { select: { reminderTiming: true, slug: true } },
    },
  })

  if (!event) return err('NOT_FOUND', 'Calendar event not found', 404)
  if (event.status !== 'CONFIRMED') {
    return err('CONFLICT', 'Event is not confirmed', 409)
  }

  const alreadySent = timing === '24h' ? event.reminder24hSent : event.reminder1hSent
  if (alreadySent) return ok({ sent: false, reason: 'already_sent' })

  const to = event.contact?.email
  if (!to) return err('VALIDATION_ERROR', 'Contact has no email', 422)

  const from = process.env.RESEND_FROM_EMAIL ?? 'bookings@jf-digital.com'
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://book.jf-digital.com'
  const { subject, html } = renderReminderEmail(timing, event, baseUrl)

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    await resend.emails.send({ from, to, subject, html })
  } catch {
    return err('EMAIL_SEND_FAILED', 'Failed to send reminder email', 502)
  }

  await markReminderSent(eventId, timing)
  return ok({ sent: true, eventId, timing })
}
