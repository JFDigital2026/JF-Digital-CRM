import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseRange, monthlySubValue } from '@/lib/metrics'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))

  const [
    paidRevenue,
    activeSubs,
    wonOpps,
    closedOpps,
    totalContacts,
    oppsCreated,
    subsCancelled,
    totalActiveSubs,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'PAID', createdAt: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { product: { select: { price: true, interval: true } } },
    }),
    prisma.opportunity.findMany({
      where: { outcome: 'WON', updatedAt: { gte: range.from, lte: range.to } },
      select: { value: true, wonAmount: true },
    }),
    prisma.opportunity.count({
      where: {
        outcome: { in: ['WON', 'LOST'] },
        updatedAt: { gte: range.from, lte: range.to },
      },
    }),
    prisma.contact.count({ where: { createdAt: { lte: range.from } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.subscription.count({
      where: { cancelledAt: { gte: range.from, lte: range.to } },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE', createdAt: { lte: range.from } } }),
  ])

  const totalRevenue = paidRevenue._sum.amount ?? 0
  const mrr = activeSubs.reduce((s, sub) => s + monthlySubValue(sub.product, sub.customAmount), 0)

  const wonValues = wonOpps.map((o) => o.wonAmount ?? o.value ?? 0)
  const avgDealSize = wonValues.length > 0 ? wonValues.reduce((s, v) => s + v, 0) / wonValues.length : 0
  const winRate = closedOpps > 0 ? (wonOpps.length / closedOpps) * 100 : 0

  // Lead → Opp: contacts created in range who got an opportunity
  const contactsInRange = await prisma.contact.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    select: { id: true },
  })
  const contactIds = contactsInRange.map((c) => c.id)
  const oppsFromContacts = contactIds.length > 0
    ? await prisma.opportunity.count({ where: { contactId: { in: contactIds } } })
    : 0
  const leadToOppRate = contactIds.length > 0 ? (oppsFromContacts / contactIds.length) * 100 : 0

  // Opp → Close: opps created in range that closed won
  const oppToCloseRate = oppsCreated > 0 ? (wonOpps.length / oppsCreated) * 100 : 0

  // Retention / Churn
  const churnRate = totalActiveSubs > 0 ? (subsCancelled / totalActiveSubs) * 100 : 0
  const retentionRate = 100 - churnRate

  return NextResponse.json({
    totalRevenue,
    mrr,
    avgDealSize,
    winRate,
    leadToOppRate,
    oppToCloseRate,
    retentionRate,
    churnRate,
  })
}
