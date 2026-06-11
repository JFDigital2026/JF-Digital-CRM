import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULT_AVAILABILITY = {
  monday:    { enabled: true,  start: '09:00', end: '17:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
  wednesday: { enabled: true,  start: '09:00', end: '17:00' },
  thursday:  { enabled: true,  start: '09:00', end: '17:00' },
  friday:    { enabled: true,  start: '09:00', end: '17:00' },
  saturday:  { enabled: false, start: '09:00', end: '17:00' },
  sunday:    { enabled: false, start: '09:00', end: '17:00' },
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
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

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const calendars = await prisma.calendarConfig.findMany({
    where: {},
    include: { _count: { select: { events: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(calendars)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, slug, duration, timezone } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
  }

  const baseSlug = slug ? toSlug(slug) : toSlug(name)
  const finalSlug = await uniqueSlug(baseSlug)

  const calendar = await prisma.calendarConfig.create({
    data: {
      name,
      type,
      slug: finalSlug,
      duration: duration ?? 30,
      timezone: timezone ?? 'America/New_York',
      availabilityJson: DEFAULT_AVAILABILITY,
      userId: session.user.id,
    },
  })

  return NextResponse.json(calendar, { status: 201 })
}
