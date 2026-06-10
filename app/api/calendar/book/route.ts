import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { triggerAutomation } from '@/lib/automation-engine'

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
  const body = await req.json()
  const { calId, date, time, firstName, lastName, email, phone, notes } = body

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
  let contact = email
    ? await prisma.contact.findFirst({ where: { email } })
    : null

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

  // Confirmation email via Resend (non-fatal)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const dateDisplay = startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const timeDisplay = startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const bodyText = [
        `Hi ${firstName},`,
        '',
        `Your booking has been confirmed.`,
        '',
        `Calendar: ${config.name}`,
        `Date: ${dateDisplay}`,
        `Time: ${timeDisplay}`,
        `Duration: ${config.duration} minutes`,
        ...(config.confirmationMessage ? ['', config.confirmationMessage] : []),
      ].join('\n')

      await resend.emails.send({
        from: 'noreply@resend.dev',
        to: email,
        subject: `Booking Confirmed: ${config.name}`,
        text: bodyText,
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
