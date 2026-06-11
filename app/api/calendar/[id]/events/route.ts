import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createGoogleCalendarEvent } from '@/lib/google-calendar'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = { calendarConfigId: params.id }
  if (from || to) {
    where.startTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to) }   : {}),
    }
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  return NextResponse.json(events)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const calendar = await prisma.calendarConfig.findUnique({ where: { id: params.id } })
  if (!calendar) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })

  const body = await req.json()
  const { contactId, title, startTime, endTime, notes, status } = body

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: 'title, startTime and endTime are required' }, { status: 400 })
  }

  const event = await prisma.calendarEvent.create({
    data: {
      calendarConfigId: params.id,
      contactId: contactId ?? null,
      userId: session.user.id,
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      notes: notes ?? null,
      status: status ?? 'CONFIRMED',
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      contactId: contactId ?? null,
      type: 'calendar.event_created',
      description: `Calendar event "${title}" created`,
      metadata: { calendarEventId: event.id, calendarConfigId: params.id },
    },
  })

  if (contactId) {
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        contactId,
        type: 'calendar.event_created',
        description: `Calendar event "${title}" created for contact`,
        metadata: { calendarEventId: event.id, calendarConfigId: params.id },
      },
    })
  }

  // Google Calendar sync (best-effort)
  if (calendar.googleAccessToken || calendar.googleRefreshToken) {
    try {
      const contact = contactId
        ? await prisma.contact.findUnique({ where: { id: contactId } })
        : null
      const gcalId = await createGoogleCalendarEvent(calendar, {
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes: notes ?? null,
        attendeeEmail: contact?.email ?? null,
        attendeeName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      })
      if (gcalId) {
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { googleEventId: gcalId },
        })
      }
    } catch (_) {}
  }

  return NextResponse.json(event, { status: 201 })
}
