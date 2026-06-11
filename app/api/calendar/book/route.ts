import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { triggerAutomation } from '@/lib/automation-engine'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { createZoomMeeting } from '@/lib/zoom'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function generateSlots(start: string, end: string, duration: number, buffer: number): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let current = sh * 60 + sm
  const endMinutes = eh * 60 + em
  const step = duration + buffer
  while (current + duration <= endMinutes) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += step
  }
  return slots
}

async function isSlotAvailable(
  calId: string,
  dateParam: string,
  time: string,
  duration: number,
  buffer: number,
  maxPerDay: number,
  availability: Record<string, { enabled: boolean; start: string; end: string }>
): Promise<boolean> {
  const date = new Date(dateParam)
  const dayOfWeek = DAY_NAMES[date.getUTCDay()]
  const dayAvail = availability[dayOfWeek]

  if (!dayAvail?.enabled) return false

  const allSlots = generateSlots(dayAvail.start, dayAvail.end, duration, buffer)
  if (!allSlots.includes(time)) return false

  const dayStart = new Date(`${dateParam}T00:00:00.000Z`)
  const dayEnd = new Date(`${dateParam}T23:59:59.999Z`)

  const totalEventsOnDay = await prisma.calendarEvent.count({
    where: {
      calendarConfigId: calId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { not: 'CANCELLED' },
    },
  })

  if (totalEventsOnDay >= maxPerDay) return false

  const [sh, sm] = time.split(':').map(Number)
  const slotStartMs = dayStart.getTime() + (sh * 60 + sm) * 60 * 1000
  const slotEndMs = slotStartMs + duration * 60 * 1000

  const conflict = await prisma.calendarEvent.findFirst({
    where: {
      calendarConfigId: calId,
      status: { not: 'CANCELLED' },
      startTime: { lt: new Date(slotEndMs) },
      endTime: { gt: new Date(slotStartMs) },
    },
  })

  return !conflict
}

export async function POST(req: Request) {
  const rl = rateLimit(getIp(req), 10, 60_000) // 10 bookings/min per IP
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json()
  const { calId, date, time, firstName, lastName, email, phone, notes, confirmedContactId } = body

  if (!calId || !date || !time || !firstName || !lastName || !email) {
    return NextResponse.json(
      { error: 'calId, date, time, firstName, lastName and email are required' },
      { status: 400 }
    )
  }

  const config = await prisma.calendarConfig.findUnique({ where: { id: calId } })
  if (!config) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  if (!config.active) return NextResponse.json({ error: 'Calendar is not active' }, { status: 400 })

  const availability = config.availabilityJson as Record<
    string,
    { enabled: boolean; start: string; end: string }
  >

  const slotOk = await isSlotAvailable(
    calId,
    date,
    time,
    config.duration,
    config.bufferTime ?? 0,
    config.maxBookingsPerDay ?? 10,
    availability
  )

  if (!slotOk) {
    return NextResponse.json({ error: 'Slot is no longer available' }, { status: 409 })
  }

  // Find or create contact
  let contact = null

  // Use confirmed match from booking form lookup
  if (confirmedContactId) {
    contact = await prisma.contact.findUnique({ where: { id: confirmedContactId } })
  }

  // Fallback: email match
  if (!contact && email) {
    contact = await prisma.contact.findFirst({ where: { email } })
  }

  // Fallback: phone match (normalized)
  if (!contact && phone) {
    const normalized = phone.replace(/\D/g, '')
    if (normalized.length >= 7) {
      const candidates = await prisma.contact.findMany({
        where: { phone: { not: null } },
      })
      contact = candidates.find((c) => c.phone && c.phone.replace(/\D/g, '') === normalized) ?? null
    }
  }

  if (!contact) {
    contact = await prisma.contact.create({
      data: { firstName, lastName, email, phone: phone ?? null },
    })
  }

  // Build start/end times
  const startTime = new Date(`${date}T${time}:00`)
  const endTime = new Date(startTime.getTime() + config.duration * 60 * 1000)

  const title = `${firstName} ${lastName}`

  const event = await prisma.calendarEvent.create({
    data: {
      calendarConfigId: calId,
      contactId: contact.id,
      userId: config.userId,
      title,
      startTime,
      endTime,
      notes: notes ?? null,
      status: 'CONFIRMED',
    },
  })

  // ── Zoom meeting + emails (non-fatal) ────────────────────────────────────
  let zoomJoinUrl: string | null = null
  let zoomStartUrl: string | null = null

  if (process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET) {
    try {
      const topic = `${firstName} ${lastName} ${config.name}`
      const zoom = await createZoomMeeting(topic, startTime, config.duration)
      zoomJoinUrl = zoom.joinUrl
      zoomStartUrl = zoom.startUrl

      // Store Zoom link in event notes
      const updatedNotes = [notes ?? null, `Zoom: ${zoomJoinUrl}`].filter(Boolean).join('\n')
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { notes: updatedNotes },
      })
    } catch (_err) {
      // Zoom failure should not fail the booking
    }
  }

  // Emails via Resend (non-fatal)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from = process.env.RESEND_FROM_EMAIL ?? 'bookings@jf-digital.com'
      const notifyEmail = process.env.NOTIFY_EMAIL ?? 'jacefree04@gmail.com'

      const dateDisplay = startTime.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
      const timeDisplay = startTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
      })

      const zoomClientBlock = zoomJoinUrl ? `
            <tr><td style="padding:6px 0;">
              <p style="margin:0;color:#6b7d8e;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Zoom Link</p>
              <p style="margin:4px 0 0;"><a href="${zoomJoinUrl}" style="color:#415A77;font-size:15px;font-weight:600;word-break:break-all;">${zoomJoinUrl}</a></p>
            </td></tr>` : ''

      const zoomOwnerBlock = zoomStartUrl ? `
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f2f5;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Your Host Link (start the meeting)</p>
          <p style="margin:3px 0 0;"><a href="${zoomStartUrl}" style="color:#415A77;font-size:14px;word-break:break-all;">${zoomStartUrl}</a></p>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f2f5;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Guest Join Link</p>
          <p style="margin:3px 0 0;"><a href="${zoomJoinUrl}" style="color:#415A77;font-size:14px;word-break:break-all;">${zoomJoinUrl}</a></p>
        </td></tr>` : ''

      // ── Client confirmation email ────────────────────────────────────────
      const clientHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a2535;padding:28px 36px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">JF Digital</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="margin:0 0 6px;color:#4b6070;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Booking Confirmed</p>
            <h1 style="margin:0 0 24px;color:#1a2535;font-size:24px;font-weight:700;">${config.name}</h1>

            <table cellpadding="0" cellspacing="0" style="background:#f4f6f8;border-radius:8px;padding:20px 24px;width:100%;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 0;">
                  <p style="margin:0;color:#6b7d8e;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Date &amp; Time</p>
                  <p style="margin:4px 0 0;color:#1a2535;font-size:15px;font-weight:600;">${dateDisplay} at ${timeDisplay}</p>
                </td>
              </tr>
              <tr><td style="padding:6px 0;">
                <p style="margin:0;color:#6b7d8e;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Duration</p>
                <p style="margin:4px 0 0;color:#1a2535;font-size:15px;font-weight:600;">${config.duration} minutes</p>
              </td></tr>
              ${zoomClientBlock}
            </table>

            ${config.confirmationMessage ? `<p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">${config.confirmationMessage}</p>` : ''}

            <p style="margin:0 0 6px;color:#4a5568;font-size:14px;line-height:1.6;">
              Hi ${firstName}, your appointment has been confirmed.${zoomJoinUrl ? ' Use the Zoom link above to join the call.' : ''} If anything changes, please reach out as soon as possible so we can reschedule.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #edf0f3;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">JF Digital &middot; jf-digital.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

      await resend.emails.send({
        from,
        to: email,
        subject: `Confirmed: ${config.name} on ${dateDisplay}`,
        html: clientHtml,
      })

      // ── Owner notification email ─────────────────────────────────────────
      const notifyHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 20px;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <tr><td style="background:#1a2535;padding:20px 28px;">
      <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">New Booking — ${config.name}</p>
    </td></tr>
    <tr><td style="padding:28px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f2f5;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Name</p>
          <p style="margin:3px 0 0;color:#1a2535;font-size:14px;font-weight:600;">${firstName} ${lastName}</p>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f2f5;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Email</p>
          <p style="margin:3px 0 0;color:#1a2535;font-size:14px;">${email}</p>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f2f5;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Phone</p>
          <p style="margin:3px 0 0;color:#1a2535;font-size:14px;">${phone ?? 'Not provided'}</p>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f2f5;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Date &amp; Time</p>
          <p style="margin:3px 0 0;color:#1a2535;font-size:14px;font-weight:600;">${dateDisplay} at ${timeDisplay}</p>
        </td></tr>
        ${zoomOwnerBlock}
        ${notes ? `<tr><td style="padding:8px 0;">
          <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Notes</p>
          <p style="margin:3px 0 0;color:#4a5568;font-size:14px;">${notes}</p>
        </td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body>
</html>`

      await resend.emails.send({
        from,
        to: notifyEmail,
        subject: `New booking: ${firstName} ${lastName} — ${config.name} — ${dateDisplay} at ${timeDisplay}`,
        html: notifyHtml,
      })
    } catch (_err) {
      // Email failure should not fail the booking
    }
  }

  // Queue reminders (best-effort)
  try {
    for (const timing of config.reminderTiming) {
      let offsetMs = 0
      if (timing === '24h') offsetMs = 24 * 60 * 60 * 1000
      else if (timing === '1h') offsetMs = 60 * 60 * 1000

      if (offsetMs > 0) {
        const executeAt = new Date(startTime.getTime() - offsetMs)
        if (executeAt > new Date()) {
          // AutomationQueue requires an automationId FK — find a stub or skip gracefully
          const automation = await prisma.automation.findFirst({
            where: { userId: config.userId },
          })
          if (automation) {
            await prisma.automationQueue.create({
              data: {
                automationId: automation.id,
                contactId: contact.id,
                actionPayload: {
                  type: 'reminder_email',
                  calendarEventId: event.id,
                  email,
                  name: `${firstName} ${lastName}`,
                },
                executeAt,
              },
            })
          }
        }
      }
    }
  } catch (_err) {
    // Reminder queuing failure should not fail the booking
  }

  // Notification for calendar owner
  await prisma.notification.create({
    data: {
      userId: config.userId,
      type: 'APPOINTMENT_BOOKED',
      title: 'New Appointment Booked',
      body: `${firstName} ${lastName} booked ${config.name} for ${startTime.toLocaleString()}`,
    },
  })

  // Activity log
  await prisma.activityLog.create({
    data: {
      userId: config.userId,
      contactId: contact.id,
      type: 'calendar.booked',
      description: `${firstName} ${lastName} booked "${config.name}"`,
      metadata: { calendarEventId: event.id, calendarConfigId: calId, date, time },
    },
  })

  triggerAutomation('APPOINTMENT_BOOKED', contact.id, { calendarEventId: event.id, calendarConfigId: calId, date, time }).catch(() => {})

  return NextResponse.json({
    success: true,
    event: {
      id: event.id,
      startTime: event.startTime,
      endTime: event.endTime,
      title: event.title,
    },
  })
}
