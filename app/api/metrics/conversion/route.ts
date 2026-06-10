import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseRange } from '@/lib/metrics'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))

  const [leads, opps, closedOpps, calendarEvents, paidOrders] = await Promise.all([
    prisma.contact.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.opportunity.findMany({
      where: { outcome: { in: ['WON', 'LOST'] }, updatedAt: { gte: range.from, lte: range.to } },
      include: { contact: { select: { source: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { status: true },
    }),
    prisma.order.count({ where: { status: 'PAID', createdAt: { gte: range.from, lte: range.to } } }),
  ])

  const wonOpps = closedOpps.filter((o) => o.outcome === 'WON')
  const lostOpps = closedOpps.filter((o) => o.outcome === 'LOST')

  const leadConversionRate = leads > 0 ? (opps / leads) * 100 : 0
  const winRate = closedOpps.length > 0 ? (wonOpps.length / closedOpps.length) * 100 : 0
  const oppToCloseRate = opps > 0 ? (wonOpps.length / opps) * 100 : 0
  const completedEvents = calendarEvents.filter((e) => e.status === 'COMPLETED').length
  const demoToCloseRate = completedEvents > 0 ? (wonOpps.length / completedEvents) * 100 : 0
  const quoteToCloseRate = paidOrders > 0 && closedOpps.length > 0
    ? (wonOpps.length / closedOpps.length) * 100
    : 0

  // Win/loss by source
  const sourceMap: Record<string, { won: number; lost: number }> = {}
  for (const o of closedOpps) {
    const src = o.contact?.source ?? 'Unknown'
    if (!sourceMap[src]) sourceMap[src] = { won: 0, lost: 0 }
    if (o.outcome === 'WON') sourceMap[src].won++
    else sourceMap[src].lost++
  }
  const winLossBySource = Object.entries(sourceMap).map(([name, v]) => ({ name, ...v }))

  // Conversion funnel
  const conversionFunnel = [
    { name: 'Leads', value: leads, fill: '#415A77' },
    { name: 'Opportunities', value: opps, fill: '#778DA9' },
    { name: 'Closed Won', value: wonOpps.length, fill: '#0D1B2A' },
  ]

  return NextResponse.json({
    kpis: { leadConversionRate, demoToCloseRate, quoteToCloseRate, winRate, oppToCloseRate },
    conversionFunnel,
    winLossBySource,
  })
}
