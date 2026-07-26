import type { MetricDefinition } from '@/lib/metrics/types'
import { rate, mean, sum, daysBetween, countSeries } from '@/lib/metrics/util'

const STALE_DAYS = 14

export const pipelineMetrics: MetricDefinition[] = [
  {
    id: 'pipeline.totalValue',
    label: 'Total Pipeline Value',
    category: 'pipeline',
    unit: 'currency',
    description: 'Sum of values across all open opportunities.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => sum((await l.openOpps()).map((o) => o.value ?? 0)),
  },
  {
    id: 'pipeline.weightedValue',
    label: 'Weighted Pipeline',
    category: 'pipeline',
    unit: 'currency',
    description: 'Open pipeline value multiplied by each opportunity’s win probability.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) =>
      sum((await l.openOpps()).map((o) => (o.value ?? 0) * ((o.probability ?? 50) / 100))),
  },
  {
    id: 'pipeline.openCount',
    label: 'Open Opportunities',
    category: 'pipeline',
    unit: 'number',
    description: 'Count of opportunities with no recorded outcome.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => (await l.openOpps()).length,
  },
  {
    id: 'pipeline.newOpps',
    label: 'New Opportunities',
    category: 'pipeline',
    unit: 'number',
    description: 'Opportunities created in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.oppsCreated()).length,
    series: async (l, ctx) =>
      countSeries((await l.oppsCreated()).map((o) => ({ date: o.createdAt })), ctx),
  },
  {
    id: 'pipeline.coverageRatio',
    label: 'Pipeline Coverage Ratio',
    category: 'pipeline',
    unit: 'ratio',
    description:
      'Open pipeline value divided by revenue closed in the period. Below about 3× means not enough is in play to hit the number.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [open, closed] = await Promise.all([l.openOpps(), l.closedOpps()])
      const won = closed.filter((o) => o.outcome === 'WON')
      const revenue = sum(won.map((o) => o.wonAmount ?? o.value ?? 0))
      if (!revenue) return null
      return sum(open.map((o) => o.value ?? 0)) / revenue
    },
  },
  {
    id: 'pipeline.avgLeadAge',
    label: 'Average Opportunity Age',
    category: 'pipeline',
    unit: 'days',
    description: 'Mean age in days of opportunities still open.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const open = await l.openOpps()
      return mean(open.map((o) => daysBetween(o.createdAt, new Date())))
    },
  },
  {
    id: 'pipeline.stalled',
    label: 'Stalled Opportunities',
    category: 'pipeline',
    unit: 'number',
    description: `Open opportunities with no update in ${STALE_DAYS} days.`,
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) =>
      (await l.openOpps()).filter((o) => daysBetween(o.updatedAt, new Date()) > STALE_DAYS)
        .length,
  },
  {
    id: 'pipeline.slippedCloseDates',
    label: 'Slipped Close Dates',
    category: 'pipeline',
    unit: 'number',
    description: 'Open opportunities whose expected close date has already passed.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const now = new Date()
      return (await l.openOpps()).filter((o) => o.closeDate && new Date(o.closeDate) < now)
        .length
    },
  },
  {
    id: 'pipeline.avgOpenValue',
    label: 'Average Open Deal Value',
    category: 'pipeline',
    unit: 'currency',
    description: 'Mean value of an open opportunity.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => mean((await l.openOpps()).map((o) => o.value ?? 0)),
  },
  {
    id: 'pipeline.velocity',
    label: 'Pipeline Velocity',
    category: 'pipeline',
    unit: 'currency',
    description:
      'Opportunities × win rate × average deal size ÷ cycle length. Revenue generated per day of selling.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [created, closed] = await Promise.all([l.oppsCreated(), l.closedOpps()])
      if (!closed.length || !created.length) return null
      const won = closed.filter((o) => o.outcome === 'WON')
      const winRate = won.length / closed.length
      const avgValue = mean(won.map((o) => o.wonAmount ?? o.value ?? 0)) ?? 0
      const cycle = mean(closed.map((o) => daysBetween(o.createdAt, o.updatedAt)))
      if (!cycle) return null
      return (created.length * winRate * avgValue) / cycle
    },
  },
  {
    id: 'pipeline.qualifiedLeads',
    label: 'Qualified Leads',
    category: 'pipeline',
    unit: 'number',
    description: 'Contacts created in the period and entering the pipeline.',
    higherIsBetter: true,
    resolve: async (l) => (await l.contacts()).length,
  },
  {
    id: 'pipeline.stageConversionRate',
    label: 'Stage Conversion Rate',
    category: 'pipeline',
    unit: 'percent',
    description: 'Share of opportunities advancing from each stage to the next.',
    higherIsBetter: true,
    unavailable: 'needs-stage-history',
  },
  {
    id: 'pipeline.avgTimeInStage',
    label: 'Average Time in Stage',
    category: 'pipeline',
    unit: 'days',
    description:
      'Days an opportunity sits in each stage. The metric that finds where deals actually die.',
    higherIsBetter: false,
    unavailable: 'needs-stage-history',
  },
]

export const conversionMetrics: MetricDefinition[] = [
  {
    id: 'conversion.leadToOpp',
    label: 'Lead → Opportunity Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Contacts created in the period that produced an opportunity.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [contacts, opps] = await Promise.all([l.contacts(), l.oppsCreated()])
      const withOpps = new Set(opps.map((o) => o.contactId).filter(Boolean)).size
      return rate(withOpps, contacts.length)
    },
  },
  {
    id: 'conversion.leadConversionRate',
    label: 'Lead Conversion Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Opportunities created divided by leads created in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [contacts, opps] = await Promise.all([l.contacts(), l.oppsCreated()])
      return rate(opps.length, contacts.length)
    },
  },
  {
    id: 'conversion.oppToClose',
    label: 'Opportunity → Close Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Opportunities created in the period that closed won.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [created, closed] = await Promise.all([l.oppsCreated(), l.closedOpps()])
      const won = closed.filter((o) => o.outcome === 'WON').length
      return rate(won, created.length)
    },
  },
  {
    id: 'conversion.winRate',
    label: 'Win Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Won divided by all decided opportunities in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const closed = await l.closedOpps()
      return rate(closed.filter((o) => o.outcome === 'WON').length, closed.length)
    },
  },
  {
    id: 'conversion.demoToClose',
    label: 'Demo → Close Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Won opportunities divided by completed meetings.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [events, closed] = await Promise.all([l.eventsCreated(), l.closedOpps()])
      const completed = events.filter((e) => e.status === 'COMPLETED').length
      return rate(closed.filter((o) => o.outcome === 'WON').length, completed)
    },
  },
  {
    id: 'conversion.proposalAcceptRate',
    label: 'Proposal Accept Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Decided opportunities that ended won.',
    higherIsBetter: true,
    resolve: async (l) => {
      const closed = await l.closedOpps()
      return rate(closed.filter((o) => o.outcome === 'WON').length, closed.length)
    },
  },
  {
    id: 'conversion.salesCycleDays',
    label: 'Sales Cycle Length',
    category: 'conversion',
    unit: 'days',
    description: 'Mean days from opportunity created to closed.',
    higherIsBetter: false,
    resolve: async (l) => {
      const closed = await l.closedOpps()
      return mean(closed.map((o) => daysBetween(o.createdAt, o.updatedAt)))
    },
  },
  {
    id: 'conversion.salesCycleCompletionRate',
    label: 'Sales Cycle Completion Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Opportunities closed in the period as a share of all opportunities ever created.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [closed, total] = await Promise.all([l.closedOpps(), l.allOppCount()])
      return rate(closed.length, total)
    },
  },
  {
    id: 'conversion.lostCount',
    label: 'Deals Lost',
    category: 'conversion',
    unit: 'number',
    description: 'Opportunities closed lost in the period.',
    higherIsBetter: false,
    resolve: async (l) => (await l.closedOpps()).filter((o) => o.outcome === 'LOST').length,
  },
  {
    id: 'conversion.wonCount',
    label: 'Deals Won',
    category: 'conversion',
    unit: 'number',
    description: 'Opportunities closed won in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.closedOpps()).filter((o) => o.outcome === 'WON').length,
    series: async (l, ctx) =>
      countSeries(
        (await l.closedOpps())
          .filter((o) => o.outcome === 'WON')
          .map((o) => ({ date: o.updatedAt })),
        ctx
      ),
  },
  {
    id: 'conversion.lossReasonsLogged',
    label: 'Loss Reasons Logged',
    category: 'conversion',
    unit: 'percent',
    description:
      'Share of lost deals with a recorded reason. Low coverage means the loss breakdown cannot be trusted.',
    higherIsBetter: true,
    resolve: async (l) => {
      const lost = (await l.closedOpps()).filter((o) => o.outcome === 'LOST')
      return rate(lost.filter((o) => !!o.outcomeReason).length, lost.length)
    },
  },
  {
    id: 'conversion.qualifiedLeadRate',
    label: 'Qualified Lead Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Contacts created in the period whose status reached active or trial.',
    higherIsBetter: true,
    resolve: async (l) => {
      const contacts = await l.contacts()
      const qualified = contacts.filter(
        (c) => c.leadStatus === 'ACTIVE' || c.leadStatus === 'TRIAL'
      ).length
      return rate(qualified, contacts.length)
    },
  },
  {
    id: 'conversion.disqualRate',
    label: 'Disqualification Rate',
    category: 'conversion',
    unit: 'percent',
    description: 'Inverse of the qualified lead rate.',
    higherIsBetter: false,
    resolve: async (l) => {
      const contacts = await l.contacts()
      const qualified = contacts.filter(
        (c) => c.leadStatus === 'ACTIVE' || c.leadStatus === 'TRIAL'
      ).length
      const r = rate(qualified, contacts.length)
      return r === null ? null : 100 - r
    },
  },
]
