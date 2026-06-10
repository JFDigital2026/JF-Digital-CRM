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

  const [openOpps, newOpps, closedOpps, stages, allContacts, contactsWithOpps] = await Promise.all([
    prisma.opportunity.findMany({
      where: { outcome: null, createdAt: { lte: range.to } },
      include: { stage: { select: { name: true, order: true } } },
    }),
    prisma.opportunity.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { id: true, createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: { outcome: { in: ['WON', 'LOST'] }, updatedAt: { gte: range.from, lte: range.to } },
      select: { outcome: true, value: true, wonAmount: true, createdAt: true, updatedAt: true },
    }),
    prisma.stage.findMany({ orderBy: { order: 'asc' } }),
    prisma.contact.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.opportunity.findMany({
      where: { createdAt: { gte: range.from, lte: range.to }, contactId: { not: null } },
      select: { contactId: true },
      distinct: ['contactId'],
    }),
  ])

  // KPIs
  const totalPipelineValue = openOpps.reduce((s, o) => s + (o.value ?? 0), 0)

  const wonOpps = closedOpps.filter((o) => o.outcome === 'WON')
  const totalRevenue = wonOpps.reduce((s, o) => s + (o.wonAmount ?? o.value ?? 0), 0)
  const pipelineCoverageRatio = totalRevenue > 0 ? totalPipelineValue / totalRevenue : null

  const qualifiedLeads = allContacts
  const newOppsCount = newOpps.length

  // Lead → Opp conversion
  const contactsInRange = await prisma.contact.count({ where: { createdAt: { gte: range.from, lte: range.to } } })
  const leadToOppRate = contactsInRange > 0 ? (contactsWithOpps.length / contactsInRange) * 100 : 0

  // Opp → Close
  const oppToCloseRate = newOpps.length > 0 ? (wonOpps.length / newOpps.length) * 100 : 0

  // Avg age of leads in pipeline (days)
  const now = new Date()
  const avgAge = openOpps.length > 0
    ? openOpps.reduce((s, o) => s + (now.getTime() - new Date(o.createdAt).getTime()) / 86_400_000, 0) / openOpps.length
    : 0

  // Value by stage
  const stageMap: Record<string, { name: string; order: number; value: number; count: number }> = {}
  for (const s of stages) stageMap[s.id] = { name: s.name, order: s.order, value: 0, count: 0 }
  for (const o of openOpps) {
    if (stageMap[o.stageId]) {
      stageMap[o.stageId].value += o.value ?? 0
      stageMap[o.stageId].count += 1
    }
  }
  const valueByStage = Object.values(stageMap).sort((a, b) => a.order - b.order)

  // Opps created over time
  const oppsBucket: Record<string, number> = {}
  for (const o of newOpps) {
    const key = bucketKey(new Date(o.createdAt), gran)
    oppsBucket[key] = (oppsBucket[key] ?? 0) + 1
  }
  const oppsOverTime = fillTimeSeries(range, gran, oppsBucket)

  // Stage conversion funnel (all active + closed opps in range by stage)
  const funnelData = [
    { name: 'Leads', value: contactsInRange },
    { name: 'Opportunities', value: newOppsCount },
    { name: 'Closed Won', value: wonOpps.length },
  ]

  return NextResponse.json({
    kpis: {
      totalPipelineValue,
      pipelineCoverageRatio,
      leadToOppRate,
      oppToCloseRate,
      qualifiedLeads,
      newOppsCount,
      avgLeadAge: avgAge,
    },
    valueByStage,
    oppsOverTime,
    stageFunnel: funnelData,
    granularity: gran,
  })
}
