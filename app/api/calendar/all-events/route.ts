import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Prisma.CalendarEventWhereInput = {}
  if (from) where.startTime = { ...(where.startTime as object ?? {}), gte: new Date(from) }
  if (to) where.startTime = { ...(where.startTime as object ?? {}), lte: new Date(to) }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      calendarConfig: { select: { id: true, name: true, meetingColor: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  return NextResponse.json({ events })
}
