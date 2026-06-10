import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const calId = searchParams.get('calId')
  const dateParam = searchParams.get('date')

  if (!calId || !dateParam) {
    return NextResponse.json({ error: 'calId and date are required' }, { status: 400 })
  }

  const config = await prisma.calendarConfig.findUnique({ where: { id: calId } })
  if (!config) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  if (!config.active) return NextResponse.json({ available: false, slots: [] })

  const date = new Date(dateParam)
  const dayOfWeek = DAY_NAMES[date.getUTCDay()]
  const availability = config.availabilityJson as Record<string, { enabled: boolean; start: string; end: string }>
  const dayAvail = availability[dayOfWeek]

  if (!dayAvail?.enabled) {
    return NextResponse.json({ available: false, slots: [] })
  }

  const duration = config.duration
  const buffer = config.bufferTime ?? 0
  const maxPerDay = config.maxBookingsPerDay ?? 10

  // Date boundaries for the requested day (UTC)
  const dayStart = new Date(`${dateParam}T00:00:00.000Z`)
  const dayEnd = new Date(`${dateParam}T23:59:59.999Z`)

  // Count total events on this date
  const totalEventsOnDay = await prisma.calendarEvent.count({
    where: {
      calendarConfigId: calId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { not: 'CANCELLED' },
    },
  })

  if (totalEventsOnDay >= maxPerDay) {
    return NextResponse.json({ available: false, slots: [] })
  }

  const allSlots = generateSlots(dayAvail.start, dayAvail.end, duration, buffer)

  // Fetch existing (non-cancelled) events for this day
  const existingEvents = await prisma.calendarEvent.findMany({
    where: {
      calendarConfigId: calId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { not: 'CANCELLED' },
    },
    select: { startTime: true, endTime: true },
  })

  const availableSlots = allSlots.filter((slot) => {
    const [sh, sm] = slot.split(':').map(Number)
    const slotStartMs = dayStart.getTime() + (sh * 60 + sm) * 60 * 1000
    const slotEndMs = slotStartMs + duration * 60 * 1000

    return !existingEvents.some((ev) => {
      const evStart = ev.startTime.getTime()
      const evEnd = ev.endTime.getTime()
      return evStart < slotEndMs && evEnd > slotStartMs
    })
  })

  return NextResponse.json({ available: availableSlots.length > 0, slots: availableSlots })
}
