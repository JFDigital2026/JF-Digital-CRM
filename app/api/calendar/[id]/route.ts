import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  let candidate = base
  let suffix = 2
  while (true) {
    const existing = await prisma.calendarConfig.findUnique({
      where: { slug: candidate },
    })
    if (!existing || existing.id === excludeId) return candidate
    candidate = `${base}-${suffix++}`
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const calendar = await prisma.calendarConfig.findUnique({
    where: { id: params.id },
    include: {
      events: {
        orderBy: { startTime: 'desc' },
        take: 20,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  })

  if (!calendar) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (calendar.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(calendar)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.calendarConfig.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const {
    name,
    type,
    description,
    active,
    availabilityJson,
    duration,
    bufferTime,
    maxBookingsPerDay,
    slug,
    confirmationMessage,
    reminderTiming,
    roundRobin,
    timezone,
    meetingInterval,
    meetingIntervalUnit,
    minSchedulingNotice,
    minSchedulingNoticeUnit,
    dateRange,
    dateRangeUnit,
    preBufferTime,
    maxBookingsPerSlot,
    lookBusy,
    lookBusyPercent,
    meetingDistribution,
    meetingLocations,
    meetingInviteTitle,
    meetingColor,
    group,
  } = body

  let finalSlug: string | undefined
  if (slug !== undefined) {
    finalSlug = await uniqueSlug(toSlug(slug), params.id)
  }

  const data: Record<string, unknown> = {}
  if (name !== undefined)               data.name = name
  if (type !== undefined)               data.type = type
  if (description !== undefined)        data.description = description
  if (active !== undefined)             data.active = active
  if (availabilityJson !== undefined)   data.availabilityJson = availabilityJson
  if (duration !== undefined)           data.duration = duration
  if (bufferTime !== undefined)         data.bufferTime = bufferTime
  if (maxBookingsPerDay !== undefined)  data.maxBookingsPerDay = maxBookingsPerDay
  if (finalSlug !== undefined)          data.slug = finalSlug
  if (confirmationMessage !== undefined) data.confirmationMessage = confirmationMessage
  if (reminderTiming !== undefined)     data.reminderTiming = reminderTiming
  if (roundRobin !== undefined)         data.roundRobin = roundRobin
  if (timezone !== undefined)           data.timezone = timezone
  if (meetingInterval !== undefined)         data.meetingInterval = meetingInterval
  if (meetingIntervalUnit !== undefined)     data.meetingIntervalUnit = meetingIntervalUnit
  if (minSchedulingNotice !== undefined)     data.minSchedulingNotice = minSchedulingNotice
  if (minSchedulingNoticeUnit !== undefined) data.minSchedulingNoticeUnit = minSchedulingNoticeUnit
  if (dateRange !== undefined)               data.dateRange = dateRange
  if (dateRangeUnit !== undefined)           data.dateRangeUnit = dateRangeUnit
  if (preBufferTime !== undefined)           data.preBufferTime = preBufferTime
  if (maxBookingsPerSlot !== undefined)      data.maxBookingsPerSlot = maxBookingsPerSlot
  if (lookBusy !== undefined)                data.lookBusy = lookBusy
  if (lookBusyPercent !== undefined)         data.lookBusyPercent = lookBusyPercent
  if (meetingDistribution !== undefined)     data.meetingDistribution = meetingDistribution
  if (meetingLocations !== undefined)        data.meetingLocations = meetingLocations
  if (meetingInviteTitle !== undefined)      data.meetingInviteTitle = meetingInviteTitle
  if (meetingColor !== undefined)            data.meetingColor = meetingColor
  if (group !== undefined)                   data.group = group

  const updated = await prisma.calendarConfig.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.calendarConfig.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.calendarEvent.deleteMany({ where: { calendarConfigId: params.id } })
  await prisma.calendarConfig.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
