export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 1) return NextResponse.json({ contacts: [], companies: [], opportunities: [], tasks: [] })

    const mode = 'insensitive' as const

    // Only search entity types the caller is allowed to view — otherwise global
    // search would leak records a restricted role can't otherwise reach.
    const [contacts, companies, opportunities, tasks] = await Promise.all([
      can(session, 'contacts', 'view')
        ? prisma.contact.findMany({
            where: {
              OR: [
                { firstName: { contains: q, mode } },
                { lastName: { contains: q, mode } },
                { email: { contains: q, mode } },
              ],
            },
            take: 3,
            select: { id: true, firstName: true, lastName: true, email: true, leadStatus: true },
          })
        : [],
      can(session, 'companies', 'view')
        ? prisma.company.findMany({
            where: { name: { contains: q, mode } },
            take: 3,
            select: { id: true, name: true, industry: true },
          })
        : [],
      can(session, 'pipelines', 'view')
        ? prisma.opportunity.findMany({
            where: { title: { contains: q, mode } },
            take: 3,
            include: { stage: { select: { name: true } } },
          })
        : [],
      can(session, 'tasks', 'view')
        ? prisma.task.findMany({
            where: { title: { contains: q, mode } },
            take: 3,
            select: { id: true, title: true, status: true, priority: true },
          })
        : [],
    ])

    return NextResponse.json({ contacts, companies, opportunities, tasks })
  } catch (err) {
    console.error('[search]', err)
    return NextResponse.json({ contacts: [], companies: [], opportunities: [], tasks: [] })
  }
}
