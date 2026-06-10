import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseRange, getGranularity, bucketKey, fillTimeSeries } from '@/lib/metrics'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))
  const gran = getGranularity(range)

  const [contacts, oppsInRange, calendarEvents, closedOpps, paidOrders, allOpps] = await Promise.all([
    prisma.contact.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { leadStatus: true, source: true },
    }),
    prisma.opportunity.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { probability: true, value: true, outcome: true },
    }),
    prisma.calendarEvent.findMany({
      where: { startTime: { gte: range.from, lte: range.to } },
      select: { status: true, createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: { outcome: { in: ['WON', 'LOST'] }, updatedAt: { gte: range.from, lte: range.to } },
      select: { outcome: true, value: true, wonAmount: true },
    }),
    prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: range.from, lte: range.to } },
      select: { amount: true, product: { select: { price: true } } },
    }),
    prisma.opportunity.count(),
  ])

  const totalContacts = contacts.length
  const qualifiedContacts = contacts.filter((c) => c.leadStatus === 'ACTIVE' || c.leadStatus === 'TRIAL').length
  const qualifiedLeadRate = totalContacts > 0 ? (qualifiedContacts / totalContacts) * 100 : 0
  const disqualRate = 100 - qualifiedLeadRate

  const completedEvents = calendarEvents.filter((e) => e.status === 'COMPLETED').length
  const noShowEvents = calendarEvents.filter((e) => e.status === 'NO_SHOW').length
  const noShowRate = (completedEvents + noShowEvents) > 0 ? (noShowEvents / (completedEvents + noShowEvents)) * 100 : 0

  const wonOpps = closedOpps.filter((o) => o.outcome === 'WON')
  const proposalAcceptRate = closedOpps.length > 0 ? (wonOpps.length / closedOpps.length) * 100 : 0

  // Discount rate: avg (1 - actualAmount/listPrice) across paid orders
  const discountRates = paidOrders
    .filter((o) => o.product?.price && o.product.price > 0)
    .map((o) => Math.max(0, (o.product.price - o.amount) / o.product.price))
  const discountRate = discountRates.length > 0 ? (discountRates.reduce((s, v) => s + v, 0) / discountRates.length) * 100 : 0

  const avgSellingPrice = paidOrders.length > 0 ? paidOrders.reduce((s, o) => s + o.amount, 0) / paidOrders.length : 0

  // Sales cycle: avg days from opp created to closed
  const closedWithDates = await prisma.opportunity.findMany({
    where: { outcome: { in: ['WON', 'LOST'] }, updatedAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true, updatedAt: true, outcome: true },
  })
  const salesCycleDays = closedWithDates.length > 0
    ? closedWithDates.reduce((s, o) => s + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86_400_000, 0) / closedWithDates.length
    : 0

  const salesCycleCompletionRate = allOpps > 0 ? (closedWithDates.length / allOpps) * 100 : 0

  // Lead quality score: composite (qualifiedLeadRate * 0.4 + proposalAcceptRate * 0.3 + (100 - noShowRate) * 0.3)
  const leadQualityScore = qualifiedLeadRate * 0.4 + proposalAcceptRate * 0.3 + (100 - noShowRate) * 0.3
  const oppQuality = oppsInRange.length > 0
    ? oppsInRange.reduce((s, o) => s + (o.probability ?? 50), 0) / oppsInRange.length
    : 0

  // No-show trend
  const noShowBucket: Record<string, number> = {}
  const totalBucket: Record<string, number> = {}
  for (const e of calendarEvents) {
    const key = bucketKey(new Date(e.createdAt), gran)
    totalBucket[key] = (totalBucket[key] ?? 0) + 1
    if (e.status === 'NO_SHOW') noShowBucket[key] = (noShowBucket[key] ?? 0) + 1
  }
  const noShowRateData: Record<string, number> = {}
  for (const key of Object.keys(totalBucket)) {
    noShowRateData[key] = totalBucket[key] > 0 ? ((noShowBucket[key] ?? 0) / totalBucket[key]) * 100 : 0
  }
  const noShowTrend = fillTimeSeries(range, gran, noShowRateData)

  // Lead quality over time — qualified leads rate per bucket
  const qualBucket: Record<string, number> = {}
  const totalLeadBucket: Record<string, number> = {}
  const allContactsInRange = await prisma.contact.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true, leadStatus: true },
  })
  for (const c of allContactsInRange) {
    const key = bucketKey(new Date(c.createdAt), gran)
    totalLeadBucket[key] = (totalLeadBucket[key] ?? 0) + 1
    if (c.leadStatus === 'ACTIVE' || c.leadStatus === 'TRIAL') {
      qualBucket[key] = (qualBucket[key] ?? 0) + 1
    }
  }
  const qualRateData: Record<string, number> = {}
  for (const key of Object.keys(totalLeadBucket)) {
    qualRateData[key] = totalLeadBucket[key] > 0 ? ((qualBucket[key] ?? 0) / totalLeadBucket[key]) * 100 : 0
  }
  const leadQualityOverTime = fillTimeSeries(range, gran, qualRateData)

  return NextResponse.json({
    kpis: {
      leadQualityScore,
      oppQuality,
      qualifiedLeadRate,
      disqualRate,
      noShowRate,
      proposalAcceptRate,
      discountRate,
      avgSellingPrice,
      salesCycleCompletionRate,
      salesCycleDays,
    },
    noShowTrend,
    leadQualityOverTime,
    granularity: gran,
  })
}
