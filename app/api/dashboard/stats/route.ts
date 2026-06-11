export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function monthBounds(year: number, month: number) {
  return {
    gte: new Date(year, month, 1),
    lte: new Date(year, month + 1, 0, 23, 59, 59, 999),
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const thisMonth = monthBounds(y, m)
    const lastMonth = monthBounds(y, m - 1)
    const todayEnd = new Date(y, m, now.getDate(), 23, 59, 59, 999)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      revThisMonth,
      revLastMonth,
      openOpps,
      tasksDueToday,
      newContactsThis,
      newContactsLast,
      apptThis,
      apptCompleted,
      recentActivity,
      pipelines,
      revenueOrders,
      activeSubs,
      autoThis,
      autoFailed,
      upcomingTasks,
    ] = await Promise.all([
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'PAID', createdAt: thisMonth } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'PAID', createdAt: lastMonth } }),
      prisma.opportunity.aggregate({ _sum: { value: true }, where: { outcome: null } }),
      prisma.task.findMany({
        where: { dueDate: { lte: todayEnd }, status: { not: 'COMPLETED' } },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.contact.count({ where: { createdAt: thisMonth } }),
      prisma.contact.count({ where: { createdAt: lastMonth } }),
      prisma.calendarEvent.count({ where: { startTime: thisMonth } }),
      prisma.calendarEvent.count({ where: { status: 'COMPLETED', startTime: thisMonth } }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.pipeline.findMany({
        where: { userId: session.user.id },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: { opportunities: { where: { outcome: null }, select: { value: true } } },
          },
        },
      }),
      prisma.order.findMany({
        where: { status: 'PAID', createdAt: { gte: thirtyDaysAgo } },
        select: { amount: true, createdAt: true },
      }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { product: { select: { price: true } } },
      }),
      prisma.automationLog.count({ where: { executedAt: thisMonth } }),
      prisma.automationLog.count({ where: { status: 'FAILED' as any, executedAt: thisMonth } }),
      prisma.task.findMany({
        where: { dueDate: { gt: todayEnd }, status: { not: 'COMPLETED' } },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ])

    // Revenue trend: fill every day of last 30
    const trendMap: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo.getTime() + i * 86400000)
      trendMap[d.toISOString().slice(0, 10)] = 0
    }
    for (const o of revenueOrders) {
      const k = o.createdAt.toISOString().slice(0, 10)
      if (k in trendMap) trendMap[k] += o.amount
    }
    const revenueTrend = Object.entries(trendMap).map(([date, revenue]) => ({ date, revenue }))

    const mrr = activeSubs.reduce((s, sub) => s + (sub.customAmount ?? sub.product.price), 0)

    const pipelineSummary = pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: p.stages.map((s) => ({
        id: s.id,
        name: s.name,
        count: s.opportunities.length,
        value: s.opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0),
      })),
    }))

    return NextResponse.json({
      revenueThisMonth: revThisMonth._sum.amount ?? 0,
      revenueLastMonth: revLastMonth._sum.amount ?? 0,
      mrr,
      openPipelineValue: openOpps._sum.value ?? 0,
      tasksDueToday,
      newContactsThisMonth: newContactsThis,
      newContactsLastMonth: newContactsLast,
      appointmentsThisMonth: apptThis,
      appointmentShowRate: apptThis > 0 ? Math.round((apptCompleted / apptThis) * 100) : 0,
      recentActivity,
      pipelineSummary,
      revenueTrend,
      activeSubscriptions: activeSubs.length,
      subscriptionMrr: mrr,
      automationsThisMonth: autoThis,
      automationFailures: autoFailed,
      upcomingTasks,
    })
  } catch (err) {
    console.error('[dashboard/stats]', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
