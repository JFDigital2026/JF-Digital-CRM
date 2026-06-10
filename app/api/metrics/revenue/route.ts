import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseRange, getGranularity, bucketKey, fillTimeSeries, monthlySubValue } from '@/lib/metrics'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))
  const gran = getGranularity(range)

  const periodMs = range.to.getTime() - range.from.getTime()
  const prevRange = { from: new Date(range.from.getTime() - periodMs), to: range.from }

  const [paidOrders, activeSubs, wonOpps, prevRevenue, subsByMonth] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: range.from, lte: range.to } },
      include: { product: { select: { name: true, type: true } } },
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { product: { select: { price: true, interval: true } } },
    }),
    prisma.opportunity.findMany({
      where: { outcome: 'WON', updatedAt: { gte: range.from, lte: range.to } },
      select: { value: true, wonAmount: true },
    }),
    prisma.order.aggregate({
      where: { status: 'PAID', createdAt: { gte: prevRange.from, lte: prevRange.to } },
      _sum: { amount: true },
    }),
    // Subscriptions created per bucket for MRR trend approximation
    prisma.subscription.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      include: { product: { select: { price: true, interval: true } } },
    }),
  ])

  // KPIs
  const totalRevenue = paidOrders.reduce((s, o) => s + o.amount, 0)
  const mrr = activeSubs.reduce((s, sub) => s + monthlySubValue(sub.product, sub.customAmount), 0)
  const arr = mrr * 12
  const acv = arr

  const wonValues = wonOpps.map((o) => o.wonAmount ?? o.value ?? 0)
  const avgDealSize = wonValues.length > 0 ? wonValues.reduce((s, v) => s + v, 0) / wonValues.length : 0

  const oneTimeOrders = paidOrders.filter((o) => o.product.type === 'ONE_TIME')
  const newBizRevenue = oneTimeOrders.reduce((s, o) => s + o.amount, 0)

  const expansionRevenue = subsByMonth.reduce((s, sub) => s + (sub.customAmount ?? sub.product.price), 0)

  // Repeat business: contacts with >1 paid order
  const contactOrderCounts: Record<string, number> = {}
  for (const o of paidOrders) {
    if (o.contactId) contactOrderCounts[o.contactId] = (contactOrderCounts[o.contactId] ?? 0) + 1
  }
  const repeatIds = new Set(Object.entries(contactOrderCounts).filter(([, c]) => c > 1).map(([id]) => id))
  const repeatRevenue = paidOrders.filter((o) => o.contactId && repeatIds.has(o.contactId)).reduce((s, o) => s + o.amount, 0)

  const prevRev = prevRevenue._sum.amount ?? 0
  const salesGrowthRate = prevRev > 0 ? ((totalRevenue - prevRev) / prevRev) * 100 : null

  // Revenue over time
  const revBucket: Record<string, number> = {}
  for (const o of paidOrders) {
    const key = bucketKey(new Date(o.createdAt), gran)
    revBucket[key] = (revBucket[key] ?? 0) + o.amount
  }
  const revenueOverTime = fillTimeSeries(range, gran, revBucket)

  // Revenue by product
  const byProduct: Record<string, number> = {}
  for (const o of paidOrders) {
    const name = o.product.name
    byProduct[name] = (byProduct[name] ?? 0) + o.amount
  }
  const revenueByProduct = Object.entries(byProduct)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // MRR trend — cumulative MRR from subscriptions created over time
  const mrrBucket: Record<string, number> = {}
  let runningMrr = mrr
  // Walk backwards from current MRR to approximate historical MRR
  for (const sub of [...subsByMonth].reverse()) {
    const key = bucketKey(new Date(sub.createdAt), gran)
    const v = monthlySubValue(sub.product, sub.customAmount)
    mrrBucket[key] = (mrrBucket[key] ?? 0) + v
  }
  // Fill as running total
  const mrrTimeSeries = fillTimeSeries(range, gran, mrrBucket)
  let acc = runningMrr
  const mrrTrend = mrrTimeSeries.map((p) => {
    const v = acc
    acc = Math.max(0, acc - p.value)
    return { date: p.date, value: Math.round(v) }
  })

  return NextResponse.json({
    kpis: { totalRevenue, mrr, arr, acv, avgDealSize, newBizRevenue, expansionRevenue, repeatRevenue, grossProfit: totalRevenue, salesGrowthRate },
    revenueOverTime,
    revenueByProduct,
    mrrTrend,
    granularity: gran,
  })
}
