import { monthlySubValue } from '@/lib/metrics'
import type { MetricDefinition } from '@/lib/metrics/types'
import { rate, mean, sum, countSeries, daysBetween } from '@/lib/metrics/util'

const SILENT_DAYS = 30

export const retentionMetrics: MetricDefinition[] = [
  {
    id: 'retention.churnRate',
    label: 'Churn Rate',
    category: 'retention',
    unit: 'percent',
    description: 'Subscriptions cancelled in the period against the book at period start.',
    higherIsBetter: false,
    resolve: async (l) => {
      const [cancelled, before] = await Promise.all([l.subsCancelled(), l.subsBeforeWindow()])
      return rate(cancelled.length, before)
    },
  },
  {
    id: 'retention.retentionRate',
    label: 'Retention Rate',
    category: 'retention',
    unit: 'percent',
    description: 'Inverse of churn rate.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [cancelled, before] = await Promise.all([l.subsCancelled(), l.subsBeforeWindow()])
      const churn = rate(cancelled.length, before)
      return churn === null ? null : 100 - churn
    },
  },
  {
    id: 'retention.grr',
    label: 'Gross Revenue Retention',
    category: 'retention',
    unit: 'percent',
    description: 'Starting MRR less churned MRR, as a share of starting MRR. Caps at 100%.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [active, cancelled] = await Promise.all([l.activeSubs(), l.subsCancelled()])
      const mrr = sum(active.map((s) => monthlySubValue(s.product, s.customAmount)))
      const churned = sum(cancelled.map((s) => monthlySubValue(s.product, s.customAmount)))
      const start = mrr + churned
      if (!start) return null
      return ((start - churned) / start) * 100
    },
  },
  {
    id: 'retention.nrr',
    label: 'Net Revenue Retention',
    category: 'retention',
    unit: 'percent',
    description: 'Starting MRR less churn plus expansion, as a share of starting MRR.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [active, cancelled, created] = await Promise.all([
        l.activeSubs(),
        l.subsCancelled(),
        l.subsCreated(),
      ])
      const mrr = sum(active.map((s) => monthlySubValue(s.product, s.customAmount)))
      const churned = sum(cancelled.map((s) => monthlySubValue(s.product, s.customAmount)))
      const expansion = sum(created.map((s) => monthlySubValue(s.product, s.customAmount)))
      const start = mrr + churned
      if (!start) return null
      return ((start - churned + expansion) / start) * 100
    },
  },
  {
    id: 'retention.ltv',
    label: 'Lifetime Value',
    category: 'retention',
    unit: 'currency',
    description: 'Average revenue per paying contact projected over expected lifespan.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [orders, cancelled, before] = await Promise.all([
        l.paidOrders(),
        l.subsCancelled(),
        l.subsBeforeWindow(),
      ])
      const byContact: Record<string, number> = {}
      for (const o of orders) {
        if (o.contactId) byContact[o.contactId] = (byContact[o.contactId] ?? 0) + o.amount
      }
      const avgRevenue = mean(Object.values(byContact))
      if (avgRevenue === null) return null
      const churn = rate(cancelled.length, before)
      const lifespanMonths = churn && churn > 0 ? 100 / churn : 24
      return avgRevenue * (lifespanMonths / 12)
    },
  },
  {
    id: 'retention.expansionRate',
    label: 'Expansion Rate',
    category: 'retention',
    unit: 'percent',
    description: 'New subscription MRR as a share of the book at period start.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [active, cancelled, created] = await Promise.all([
        l.activeSubs(),
        l.subsCancelled(),
        l.subsCreated(),
      ])
      const mrr = sum(active.map((s) => monthlySubValue(s.product, s.customAmount)))
      const churned = sum(cancelled.map((s) => monthlySubValue(s.product, s.customAmount)))
      const start = mrr + churned
      if (!start) return null
      return (sum(created.map((s) => monthlySubValue(s.product, s.customAmount))) / start) * 100
    },
  },
  {
    id: 'retention.churnedClients',
    label: 'Clients Churned',
    category: 'retention',
    unit: 'number',
    description: 'Subscriptions cancelled in the period.',
    higherIsBetter: false,
    resolve: async (l) => (await l.subsCancelled()).length,
    series: async (l, ctx) =>
      countSeries(
        (await l.subsCancelled())
          .filter((s) => s.cancelledAt)
          .map((s) => ({ date: s.cancelledAt as Date })),
        ctx
      ),
  },
  {
    id: 'retention.newClients',
    label: 'New Clients',
    category: 'retention',
    unit: 'number',
    description: 'Subscriptions started in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.subsCreated()).length,
    series: async (l, ctx) =>
      countSeries((await l.subsCreated()).map((s) => ({ date: s.createdAt })), ctx),
  },
  {
    id: 'retention.pastDueClients',
    label: 'Past Due Subscriptions',
    category: 'retention',
    unit: 'number',
    description: 'Subscriptions in a past-due billing state right now.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const groups = await l.subsByStatus()
      return groups.find((g) => g.status === 'PAST_DUE')?._count._all ?? 0
    },
  },
  {
    id: 'retention.silentClients',
    label: 'Silent Clients',
    category: 'retention',
    unit: 'number',
    description: `Paying clients with no message in ${SILENT_DAYS} days. The earliest churn precursor available.`,
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const [active, lastMessages] = await Promise.all([
        l.activeSubs(),
        l.lastMessagePerContact(),
      ])
      const lastByContact = new Map<string, Date>()
      for (const row of lastMessages) {
        if (row.contactId && row._max.createdAt) {
          lastByContact.set(row.contactId, row._max.createdAt)
        }
      }
      const now = new Date()
      let silent = 0
      for (const sub of active) {
        if (!sub.contactId) continue
        const last = lastByContact.get(sub.contactId)
        if (!last || daysBetween(last, now) > SILENT_DAYS) silent++
      }
      return silent
    },
  },
  {
    id: 'retention.avgClientTenure',
    label: 'Average Client Tenure',
    category: 'retention',
    unit: 'days',
    description: 'Mean days since each active subscription began.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const active = await l.activeSubs()
      return mean(active.map((s) => daysBetween(s.createdAt, new Date())))
    },
  },
  {
    id: 'retention.renewalRate',
    label: 'Renewal Rate',
    category: 'retention',
    unit: 'percent',
    description:
      'Approximated by retention rate until contract term data is tracked on subscriptions.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [cancelled, before] = await Promise.all([l.subsCancelled(), l.subsBeforeWindow()])
      const churn = rate(cancelled.length, before)
      return churn === null ? null : 100 - churn
    },
  },
  {
    id: 'retention.saveRate',
    label: 'Save Rate',
    category: 'retention',
    unit: 'percent',
    description: 'At-risk clients retained after intervention.',
    higherIsBetter: true,
    unavailable: 'needs-manual-entry',
  },
  {
    id: 'retention.evolveUpdatesShipped',
    label: 'Evolve Updates Shipped',
    category: 'retention',
    unit: 'number',
    description: 'Maintenance and upgrade work delivered to existing clients.',
    higherIsBetter: true,
    unavailable: 'needs-delivery-tracking',
  },
]
