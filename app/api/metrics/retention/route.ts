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

  const [activeSubs, cancelledSubs, allSubs, paidOrders, subsPeriod] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { product: { select: { price: true, interval: true } } },
    }),
    prisma.subscription.findMany({
      where: { cancelledAt: { gte: range.from, lte: range.to } },
      include: { product: { select: { price: true, interval: true } } },
    }),
    prisma.subscription.count({ where: { createdAt: { lte: range.from } } }),
    prisma.order.findMany({
      where: { status: 'PAID', createdAt: { gte: range.from, lte: range.to } },
      select: { amount: true, contactId: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      include: { product: { select: { price: true, interval: true } } },
    }),
  ])

  const mrr = activeSubs.reduce((s, sub) => s + monthlySubValue(sub.product, sub.customAmount), 0)

  // Churn rate = cancelled / total active at start of period
  const churnRate = allSubs > 0 ? (cancelledSubs.length / allSubs) * 100 : 0
  const retentionRate = 100 - churnRate

  // Gross Revenue Retention = (start MRR - churned MRR) / start MRR
  const churnedMrr = cancelledSubs.reduce((s, sub) => s + monthlySubValue(sub.product, sub.customAmount), 0)
  const startMrr = mrr + churnedMrr
  const grr = startMrr > 0 ? ((startMrr - churnedMrr) / startMrr) * 100 : 100

  // Net Revenue Retention = (start MRR - churned MRR + expansion MRR) / start MRR
  const expansionMrr = subsPeriod.reduce((s, sub) => s + monthlySubValue(sub.product, sub.customAmount), 0)
  const nrr = startMrr > 0 ? ((startMrr - churnedMrr + expansionMrr) / startMrr) * 100 : 100

  // LTV = avg revenue per contact × avg lifespan
  const contactRevenue: Record<string, number> = {}
  for (const o of paidOrders) {
    if (o.contactId) contactRevenue[o.contactId] = (contactRevenue[o.contactId] ?? 0) + o.amount
  }
  const revenueValues = Object.values(contactRevenue)
  const avgRevenue = revenueValues.length > 0 ? revenueValues.reduce((s, v) => s + v, 0) / revenueValues.length : 0
  const avgLifespanMonths = churnRate > 0 ? 100 / churnRate : 24
  const ltv = avgRevenue * (avgLifespanMonths / 12)

  // Expansion rate
  const expansionRate = startMrr > 0 ? (expansionMrr / startMrr) * 100 : 0

  // Renewal rate (subscriptions due for renewal in range that are still active)
  const renewalRate = retentionRate // Approximation

  // Save rate = 0 (no cancellation flow data)
  const saveRate = 0

  // Churn over time
  const churnBucket: Record<string, number> = {}
  for (const sub of cancelledSubs) {
    if (sub.cancelledAt) {
      const key = bucketKey(new Date(sub.cancelledAt), gran)
      churnBucket[key] = (churnBucket[key] ?? 0) + 1
    }
  }
  const churnOverTime = fillTimeSeries(range, gran, churnBucket)

  // LTV by cohort (month of first order)
  const cohortLtv: Record<string, { total: number; count: number }> = {}
  for (const o of paidOrders) {
    const cohort = `${new Date(o.createdAt).getFullYear()}-${String(new Date(o.createdAt).getMonth() + 1).padStart(2, '0')}`
    if (!cohortLtv[cohort]) cohortLtv[cohort] = { total: 0, count: 0 }
    cohortLtv[cohort].total += o.amount
    cohortLtv[cohort].count += 1
  }
  const ltvByCohort = Object.entries(cohortLtv)
    .map(([cohort, v]) => ({ cohort, ltv: v.count > 0 ? v.total / v.count : 0 }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort))

  return NextResponse.json({
    kpis: { retentionRate, churnRate, grr, nrr, ltv, expansionRate, renewalRate, saveRate },
    churnOverTime,
    ltvByCohort,
    granularity: gran,
  })
}
