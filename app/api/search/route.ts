import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 1) return NextResponse.json({ contacts: [], companies: [], opportunities: [], tasks: [] })

    const mode = 'insensitive' as const

    const [contacts, companies, opportunities, tasks] = await Promise.all([
      prisma.contact.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode } },
            { lastName: { contains: q, mode } },
            { email: { contains: q, mode } },
          ],
        },
        take: 3,
        select: { id: true, firstName: true, lastName: true, email: true, leadStatus: true },
      }),
      prisma.company.findMany({
        where: { name: { contains: q, mode } },
        take: 3,
        select: { id: true, name: true, industry: true },
      }),
      prisma.opportunity.findMany({
        where: { title: { contains: q, mode } },
        take: 3,
        include: { stage: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: { title: { contains: q, mode } },
        take: 3,
        select: { id: true, title: true, status: true, priority: true },
      }),
    ])

    return NextResponse.json({ contacts, companies, opportunities, tasks })
  } catch (err) {
    console.error('[search]', err)
    return NextResponse.json({ contacts: [], companies: [], opportunities: [], tasks: [] })
  }
}
