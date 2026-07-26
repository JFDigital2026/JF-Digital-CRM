import { monthlySubValue } from '@/lib/metrics'
import type { MetricDefinition } from '@/lib/metrics/types'
import { rate, mean, sum, sumSeries } from '@/lib/metrics/util'

/**
 * Revenue, financial and pricing-integrity KPIs.
 *
 * Formulas for anything that also appears on the six original /metrics tabs are
 * reproduced from the existing route handlers verbatim, so the same KPI reads the
 * same on a built-in tab and a custom view. The one deliberate difference: where
 * a legacy route returns 0 for an empty denominator, these return null so the
 * card renders "—" instead of a zero that reads as a real business result.
 */
export const revenueMetrics: MetricDefinition[] = [
  {
    id: 'revenue.total',
    label: 'Total Revenue',
    category: 'revenue',
    unit: 'currency',
    description: 'Sum of paid orders in the period.',
    higherIsBetter: true,
    resolve: async (l) => sum((await l.paidOrders()).map((o) => o.amount)),
    series: async (l, ctx) =>
      sumSeries(
        (await l.paidOrders()).map((o) => ({ date: o.createdAt, value: o.amount })),
        ctx
      ),
  },
  {
    id: 'revenue.mrr',
    label: 'MRR',
    category: 'revenue',
    unit: 'currency',
    description: 'Monthly recurring revenue from all active subscriptions, normalised to a month.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) =>
      sum((await l.activeSubs()).map((s) => monthlySubValue(s.product, s.customAmount))),
  },
  {
    id: 'revenue.arr',
    label: 'ARR',
    category: 'revenue',
    unit: 'currency',
    description: 'MRR × 12.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) =>
      sum((await l.activeSubs()).map((s) => monthlySubValue(s.product, s.customAmount))) * 12,
  },
  {
    id: 'revenue.acv',
    label: 'ACV',
    category: 'revenue',
    unit: 'currency',
    description: 'Annual contract value across the active book.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) =>
      sum((await l.activeSubs()).map((s) => monthlySubValue(s.product, s.customAmount))) * 12,
  },
  {
    id: 'revenue.avgDealSize',
    label: 'Average Deal Size',
    category: 'revenue',
    unit: 'currency',
    description: 'Mean won amount across opportunities closed won in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const won = (await l.closedOpps()).filter((o) => o.outcome === 'WON')
      return mean(won.map((o) => o.wonAmount ?? o.value ?? 0))
    },
  },
  {
    id: 'revenue.newBusiness',
    label: 'New Business Revenue',
    category: 'revenue',
    unit: 'currency',
    description: 'Revenue from one-time products — build and setup fees.',
    higherIsBetter: true,
    resolve: async (l) =>
      sum(
        (await l.paidOrders())
          .filter((o) => o.product.type === 'ONE_TIME')
          .map((o) => o.amount)
      ),
  },
  {
    id: 'revenue.expansion',
    label: 'Expansion Revenue',
    category: 'revenue',
    unit: 'currency',
    description: 'Value of subscriptions started in the period.',
    higherIsBetter: true,
    resolve: async (l) =>
      sum((await l.subsCreated()).map((s) => s.customAmount ?? s.product.price)),
  },
  {
    id: 'revenue.repeat',
    label: 'Repeat Revenue',
    category: 'revenue',
    unit: 'currency',
    description: 'Revenue from contacts with more than one paid order in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const orders = await l.paidOrders()
      const counts: Record<string, number> = {}
      for (const o of orders) {
        if (o.contactId) counts[o.contactId] = (counts[o.contactId] ?? 0) + 1
      }
      const repeat = new Set(
        Object.entries(counts)
          .filter(([, c]) => c > 1)
          .map(([id]) => id)
      )
      return sum(
        orders.filter((o) => o.contactId && repeat.has(o.contactId)).map((o) => o.amount)
      )
    },
  },
  {
    id: 'revenue.growthRate',
    label: 'Revenue Growth Rate',
    category: 'revenue',
    unit: 'percent',
    description: 'Revenue change versus the preceding period of equal length.',
    higherIsBetter: true,
    resolve: async (l, prev) => {
      const [current, before] = await Promise.all([l.paidOrders(), prev.paidOrders()])
      const prevTotal = sum(before.map((o) => o.amount))
      if (!prevTotal) return null
      return ((sum(current.map((o) => o.amount)) - prevTotal) / prevTotal) * 100
    },
  },
  {
    id: 'revenue.setupFees',
    label: 'Setup Fee Revenue',
    category: 'revenue',
    unit: 'currency',
    description: 'One-time build fees collected in the period.',
    higherIsBetter: true,
    resolve: async (l) =>
      sum(
        (await l.paidOrders())
          .filter((o) => o.product.type === 'ONE_TIME')
          .map((o) => o.amount)
      ),
  },
  {
    id: 'revenue.retainerRevenue',
    label: 'Retainer Revenue',
    category: 'revenue',
    unit: 'currency',
    description: 'Monthly value of the active retainer book.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) =>
      sum((await l.activeSubs()).map((s) => monthlySubValue(s.product, s.customAmount))),
  },
  {
    id: 'revenue.avgSellingPrice',
    label: 'Average Selling Price',
    category: 'revenue',
    unit: 'currency',
    description: 'Mean amount per paid order.',
    higherIsBetter: true,
    resolve: async (l) => mean((await l.paidOrders()).map((o) => o.amount)),
  },
  {
    id: 'revenue.discountRate',
    label: 'Discount Rate',
    category: 'revenue',
    unit: 'percent',
    description: 'Average discount off list price across paid orders.',
    higherIsBetter: false,
    resolve: async (l) => {
      const orders = (await l.paidOrders()).filter((o) => o.product?.price > 0)
      const discounts = orders.map((o) =>
        Math.max(0, (o.product.price - o.amount) / o.product.price)
      )
      const avg = mean(discounts)
      return avg === null ? null : avg * 100
    },
  },
  {
    id: 'revenue.orderCount',
    label: 'Paid Orders',
    category: 'revenue',
    unit: 'number',
    description: 'Count of orders paid in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.paidOrders()).length,
  },
  {
    id: 'revenue.concentration',
    label: 'Revenue Concentration',
    category: 'revenue',
    unit: 'percent',
    description:
      'Share of MRR from the single largest client. At three clients one churn is a third of revenue — the metric solo agencies skip until it hurts.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const subs = await l.activeSubs()
      if (!subs.length) return null
      const byClient: Record<string, number> = {}
      for (const s of subs) {
        const key = s.contactId ?? s.companyId ?? s.id
        byClient[key] = (byClient[key] ?? 0) + monthlySubValue(s.product, s.customAmount)
      }
      const values = Object.values(byClient)
      const total = sum(values)
      if (!total) return null
      return (Math.max(...values) / total) * 100
    },
  },
  {
    id: 'revenue.activeClients',
    label: 'Active Paying Clients',
    category: 'revenue',
    unit: 'number',
    description: 'Distinct clients on an active subscription.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const subs = await l.activeSubs()
      return new Set(subs.map((s) => s.contactId ?? s.companyId ?? s.id)).size
    },
  },
  {
    id: 'revenue.mrrVsTarget',
    label: 'MRR vs Target',
    category: 'revenue',
    unit: 'percent',
    description:
      'Current MRR as a percentage of the MRR target set in Settings → Metrics.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const target = await l.target('revenue.mrrVsTarget')
      if (!target) return null
      const mrr = sum(
        (await l.activeSubs()).map((s) => monthlySubValue(s.product, s.customAmount))
      )
      return (mrr / target) * 100
    },
  },
  {
    id: 'revenue.mrrGapToTarget',
    label: 'MRR Gap to Target',
    category: 'revenue',
    unit: 'currency',
    description: 'Monthly recurring revenue still needed to reach the target.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const target = await l.target('revenue.mrrVsTarget')
      if (!target) return null
      const mrr = sum(
        (await l.activeSubs()).map((s) => monthlySubValue(s.product, s.customAmount))
      )
      return Math.max(0, target - mrr)
    },
  },
  {
    id: 'revenue.grossProfit',
    label: 'Gross Profit',
    category: 'revenue',
    unit: 'currency',
    description:
      'Revenue less direct costs. With no cost tracking in the CRM this equals total revenue.',
    higherIsBetter: true,
    resolve: async (l) => sum((await l.paidOrders()).map((o) => o.amount)),
  },
  {
    id: 'revenue.committedContractValue',
    label: 'Committed Contract Value',
    category: 'revenue',
    unit: 'currency',
    description:
      'MRR multiplied by the months remaining on each 6, 12 or 18 month commitment.',
    higherIsBetter: true,
    unavailable: 'needs-commitment-field',
  },
  {
    id: 'revenue.avgCommitmentLength',
    label: 'Average Commitment Length',
    category: 'revenue',
    unit: 'number',
    description: 'Mean contract term in months — are 18 month terms actually closing?',
    higherIsBetter: true,
    unavailable: 'needs-commitment-field',
  },
]

/**
 * Pricing integrity. These enforce the promises the business is built on: a
 * minimum 3× year-one client return, setup at 10-15% of annual savings, retainer
 * at 1-1.5% per month. Most need an `annualSavings` field on Opportunity that
 * does not exist yet — one nullable float unlocks the whole block.
 */
export const pricingMetrics: MetricDefinition[] = [
  {
    id: 'pricing.dealsBelowMinimum',
    label: 'Deals Below Minimum',
    category: 'pricing',
    unit: 'number',
    description:
      'Paid one-time orders under the $1,500 setup floor. A pricing-discipline check.',
    higherIsBetter: false,
    resolve: async (l) =>
      (await l.paidOrders()).filter(
        (o) => o.product.type === 'ONE_TIME' && o.amount < 1500
      ).length,
  },
  {
    id: 'pricing.retainersBelowMinimum',
    label: 'Retainers Below Minimum',
    category: 'pricing',
    unit: 'number',
    description: 'Active subscriptions billing under the $500/month floor.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) =>
      (await l.activeSubs()).filter(
        (s) => monthlySubValue(s.product, s.customAmount) < 500
      ).length,
  },
  {
    id: 'pricing.foundingMix',
    label: 'Founding Client Share',
    category: 'pricing',
    unit: 'percent',
    description:
      'Share of active retainers on founding pricing (under $500/month) rather than standard.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const subs = await l.activeSubs()
      if (!subs.length) return null
      const founding = subs.filter(
        (s) => monthlySubValue(s.product, s.customAmount) < 500
      ).length
      return rate(founding, subs.length)
    },
  },
  {
    id: 'pricing.foundingSlotsRemaining',
    label: 'Founding Slots Remaining',
    category: 'pricing',
    unit: 'number',
    description:
      'Founding client slots left out of ten. Counts distinct clients on founding pricing against the cap.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const cap = (await l.target('pricing.foundingSlotsRemaining')) ?? 10
      const subs = await l.activeSubs()
      const founding = new Set(
        subs
          .filter((s) => monthlySubValue(s.product, s.customAmount) < 500)
          .map((s) => s.contactId ?? s.companyId ?? s.id)
      ).size
      return Math.max(0, cap - founding)
    },
  },
  {
    id: 'pricing.priceRealization',
    label: 'Price Realization',
    category: 'pricing',
    unit: 'percent',
    description:
      'Actual won amount as a percentage of the quoted opportunity value — how much is given away at close.',
    higherIsBetter: true,
    resolve: async (l) => {
      const won = (await l.closedOpps()).filter(
        (o) => o.outcome === 'WON' && (o.value ?? 0) > 0
      )
      if (!won.length) return null
      const quoted = sum(won.map((o) => o.value ?? 0))
      if (!quoted) return null
      return (sum(won.map((o) => o.wonAmount ?? o.value ?? 0)) / quoted) * 100
    },
  },
  {
    id: 'pricing.annualSavingsIdentified',
    label: 'Annual Savings Identified',
    category: 'pricing',
    unit: 'currency',
    description: 'Total documented annual savings found across audits in the period.',
    higherIsBetter: true,
    unavailable: 'needs-savings-field',
  },
  {
    id: 'pricing.avgSavingsPerAudit',
    label: 'Average Savings per Audit',
    category: 'pricing',
    unit: 'currency',
    description: 'Mean value of the bottleneck found per completed audit.',
    higherIsBetter: true,
    unavailable: 'needs-savings-field',
  },
  {
    id: 'pricing.setupFeePctOfSavings',
    label: 'Setup Fee % of Savings',
    category: 'pricing',
    unit: 'percent',
    description: 'Setup fee as a share of identified annual savings. Target 10-15%.',
    higherIsBetter: true,
    unavailable: 'needs-savings-field',
  },
  {
    id: 'pricing.retainerPctOfSavings',
    label: 'Retainer % of Savings',
    category: 'pricing',
    unit: 'percent',
    description: 'Monthly retainer as a share of annual savings. Target 1-1.5%.',
    higherIsBetter: true,
    unavailable: 'needs-savings-field',
  },
  {
    id: 'pricing.clientRoiMultiple',
    label: 'Client ROI Multiple',
    category: 'pricing',
    unit: 'ratio',
    description:
      'Identified savings divided by total year-one client investment. Must stay at or above 3× — this is a guarantee, not a vanity metric.',
    higherIsBetter: true,
    unavailable: 'needs-savings-field',
  },
]
