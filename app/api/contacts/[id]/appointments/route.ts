import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const events = await prisma.calendarEvent.findMany({
    where: { contactId: params.id },
    orderBy: { startTime: 'desc' },
    take: 20,
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json(events)
}
