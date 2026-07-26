import { PrismaClient } from '@prisma/client'

/**
 * Default metric views.
 *
 * These are starting points, not fixtures — fully editable and deletable once
 * created. Seeding is skipped for any slug that already exists, so re-running
 * the seed never clobbers edits.
 *
 * Metric ids must match lib/metrics/registry.ts. Ids that no longer exist are
 * skipped at render time with an "unavailable" card rather than crashing, but
 * they are worth keeping accurate here.
 */

type SeedItem = { metricId: string; showTrend?: boolean }
type SeedView = {
  name: string
  slug: string
  description: string
  items: SeedItem[]
}

export const DEFAULT_VIEWS: SeedView[] = [
  {
    name: 'Outbound Command',
    slug: 'outbound-command',
    description: 'Is cold outreach working right now?',
    items: [
      { metricId: 'outbound.sent', showTrend: true },
      { metricId: 'outbound.openRate' },
      { metricId: 'outbound.replyRate' },
      { metricId: 'outbound.optOuts' },
      { metricId: 'outbound.optOutRate' },
      { metricId: 'outbound.meetingsPer100Emails' },
      { metricId: 'outbound.replyToMeetingRate' },
      { metricId: 'outbound.activeSendingDays' },
      { metricId: 'outbound.bounceRate' },
      { metricId: 'outbound.suppressedOpens' },
      { metricId: 'outbound.syncAgeHours' },
    ],
  },
  {
    name: 'Founder Daily',
    slug: 'founder-daily',
    description: 'One screen, checked every morning.',
    items: [
      { metricId: 'outbound.sent', showTrend: true },
      { metricId: 'activity.meetingsBooked' },
      { metricId: 'pipeline.openCount' },
      { metricId: 'revenue.mrr' },
      { metricId: 'admin.overdueTasks' },
      { metricId: 'system.automationFailures' },
      { metricId: 'activity.inboundMessages' },
      { metricId: 'pipeline.stalled' },
    ],
  },
  {
    name: 'Pipeline Review',
    slug: 'pipeline-review',
    description: 'Weekly pass to find stalled and slipping deals.',
    items: [
      { metricId: 'pipeline.totalValue' },
      { metricId: 'pipeline.weightedValue' },
      { metricId: 'pipeline.stalled' },
      { metricId: 'pipeline.slippedCloseDates' },
      { metricId: 'pipeline.avgLeadAge' },
      { metricId: 'conversion.winRate' },
      { metricId: 'conversion.salesCycleDays' },
      { metricId: 'conversion.lossReasonsLogged' },
      { metricId: 'pipeline.newOpps', showTrend: true },
    ],
  },
  {
    name: 'Founding Program',
    slug: 'founding-program',
    description: 'Progress against the ten founding slots and the MRR target.',
    items: [
      { metricId: 'pricing.foundingSlotsRemaining' },
      { metricId: 'pricing.foundingMix' },
      { metricId: 'revenue.mrr' },
      { metricId: 'revenue.mrrVsTarget' },
      { metricId: 'revenue.mrrGapToTarget' },
      { metricId: 'revenue.activeClients' },
      { metricId: 'revenue.concentration' },
      { metricId: 'pricing.dealsBelowMinimum' },
      { metricId: 'pricing.retainersBelowMinimum' },
    ],
  },
  {
    name: 'Delivery Board',
    slug: 'delivery-board',
    description:
      'Client delivery load. Fills out once delivery stage tracking exists.',
    items: [
      { metricId: 'delivery.auditsBooked', showTrend: true },
      { metricId: 'delivery.auditsCompleted' },
      { metricId: 'delivery.auditToProposalRate' },
      { metricId: 'delivery.openClientTasks' },
      { metricId: 'delivery.overdueTaskRate' },
      { metricId: 'retention.silentClients' },
      { metricId: 'delivery.activeBuilds' },
      { metricId: 'delivery.timeToFirstValue' },
    ],
  },
  {
    name: 'System Health',
    slug: 'system-health',
    description: 'Is anything broken and failing quietly?',
    items: [
      { metricId: 'system.automationSuccessRate' },
      { metricId: 'system.automationFailures' },
      { metricId: 'system.queueDepth' },
      { metricId: 'system.oldestQueueItemHours' },
      { metricId: 'system.webhookSuccessRate' },
      { metricId: 'system.webhookFailures' },
      { metricId: 'system.apiErrorRate' },
      { metricId: 'system.apiRequests', showTrend: true },
      { metricId: 'system.outboundSyncFresh' },
    ],
  },
]

export async function seedMetricViews(prisma: PrismaClient, ownerId: string) {
  let created = 0
  let order = 0

  for (const view of DEFAULT_VIEWS) {
    order++
    const existing = await prisma.metricView.findUnique({ where: { slug: view.slug } })
    if (existing) {
      console.log(`Metric view "${view.name}" already exists, skipping.`)
      continue
    }

    await prisma.metricView.create({
      data: {
        name: view.name,
        slug: view.slug,
        description: view.description,
        ownerId,
        order,
        items: {
          create: view.items.map((item, index) => ({
            metricId: item.metricId,
            showTrend: item.showTrend ?? false,
            order: index,
          })),
        },
      },
    })
    created++
    console.log(`Created metric view: ${view.name}`)
  }

  return created
}
