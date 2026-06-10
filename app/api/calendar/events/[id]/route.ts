import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { triggerAutomation } from '@/lib/automation-engine'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.calendarEvent.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.calendarEvent.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status, notes, startTime, endTime, title } = body

  const data: Record<string, unknown> = {}
  if (status !== undefined)    data.status = status
  if (notes !== undefined)     data.notes = notes
  if (startTime !== undefined) data.startTime = new Date(startTime)
  if (endTime !== undefined)   data.endTime = new Date(endTime)
  if (title !== undefined)     data.title = title

  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  if (status && status !== existing.status) {
    if (status === 'CANCELLED') {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          contactId: existing.contactId ?? null,
          type: 'calendar.event_cancelled',
          description: `Calendar event "${existing.title}" was cancelled`,
          metadata: { calendarEventId: params.id },
        },
      })
    } else if (status === 'NO_SHOW') {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          contactId: existing.contactId ?? null,
          type: 'calendar.event_no_show',
          description: `Calendar event "${existing.title}" marked as no-show`,
          metadata: { calendarEventId: params.id },
        },
      })
      if (existing.contactId) {
        await triggerAutomation('APPOINTMENT_NO_SHOW', existing.contactId, {
          calendarEventId: params.id,
          title: existing.title,
        })
      }
    }
  }

  return NextResponse.json(updated)
}
