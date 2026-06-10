import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  const [
    totalContacts,
    newContactsThisMonth,
    newContactsLastMonth,
    totalCompanies,
    openTasks,
    overdueTasks,
    activeDeals,
    wonDeals,
    recentActivity,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.contact.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.company.count(),
    prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: new Date() } } }),
    prisma.opportunity.findMany({
      where: { stage: { name: { notIn: ['Closed Won', 'Closed Lost'] } } },
      select: { value: true },
    }),
    prisma.opportunity.findMany({
      where: { stage: { name: 'Closed Won' }, updatedAt: { gte: thirtyDaysAgo } },
      select: { value: true },
    }),
    prisma.activityLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
      },
    }),
  ])

  const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)

  const contactTrend = newContactsLastMonth === 0
    ? null
    : Math.round(((newContactsThisMonth - newContactsLastMonth) / newContactsLastMonth) * 100)

  return NextResponse.json({
    stats: {
      totalContacts,
      newContactsThisMonth,
      contactTrend,
      totalCompanies,
      openTasks,
      overdueTasks,
      pipelineValue,
      activeDeals: activeDeals.length,
      wonValue,
    },
    recentActivity,
  })
}
