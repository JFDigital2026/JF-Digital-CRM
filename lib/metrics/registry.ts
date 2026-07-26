import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  UNAVAILABLE_LABELS,
  type MetricCatalogEntry,
  type MetricDefinition,
} from '@/lib/metrics/types'
import { outboundMetrics } from '@/lib/metrics/definitions/outbound'
import { revenueMetrics, pricingMetrics } from '@/lib/metrics/definitions/revenue'
import { pipelineMetrics, conversionMetrics } from '@/lib/metrics/definitions/pipeline'
import { activityMetrics } from '@/lib/metrics/definitions/activity'
import { retentionMetrics } from '@/lib/metrics/definitions/retention'
import {
  leadMetrics,
  deliveryMetrics,
  adminMetrics,
  systemMetrics,
  marketingMetrics,
} from '@/lib/metrics/definitions/ops'

/**
 * THE metric catalog. Definitions live in code, never in the database — a saved
 * view stores only string ids. That is the whole reason the settings page is a
 * picker rather than a query builder: a config row can never describe a query,
 * so it can never produce arbitrary SQL.
 *
 * Anything resolving a metric id from request input MUST go through
 * `getMetric()` and reject unknown ids before touching Prisma.
 */
const ALL: MetricDefinition[] = [
  ...outboundMetrics,
  ...leadMetrics,
  ...pipelineMetrics,
  ...conversionMetrics,
  ...activityMetrics,
  ...revenueMetrics,
  ...pricingMetrics,
  ...deliveryMetrics,
  ...retentionMetrics,
  ...adminMetrics,
  ...systemMetrics,
  ...marketingMetrics,
]

// Duplicate ids would make view items ambiguous and silently shadow a metric.
// Fail at import time rather than at render time.
const seen = new Set<string>()
for (const m of ALL) {
  if (seen.has(m.id)) throw new Error(`Duplicate metric id in registry: ${m.id}`)
  seen.add(m.id)
}

export const METRIC_REGISTRY: ReadonlyMap<string, MetricDefinition> = new Map(
  ALL.map((m) => [m.id, m])
)

export function getMetric(id: string): MetricDefinition | undefined {
  return METRIC_REGISTRY.get(id)
}

export function isKnownMetric(id: string): boolean {
  return METRIC_REGISTRY.has(id)
}

export function toCatalogEntry(m: MetricDefinition): MetricCatalogEntry {
  const available = !m.unavailable && typeof m.resolve === 'function'
  return {
    id: m.id,
    label: m.label,
    category: m.category,
    categoryLabel: CATEGORY_LABELS[m.category],
    unit: m.unit,
    description: m.description,
    higherIsBetter: m.higherIsBetter ?? true,
    supportsTrend: typeof m.series === 'function',
    available,
    unavailableReason: m.unavailable,
    unavailableLabel: m.unavailable ? UNAVAILABLE_LABELS[m.unavailable] : undefined,
  }
}

/** Full catalog, ordered by category then label — the shape the picker renders. */
export function getCatalog(): MetricCatalogEntry[] {
  return ALL.map(toCatalogEntry).sort((a, b) => {
    const byCategory =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    return byCategory !== 0 ? byCategory : a.label.localeCompare(b.label)
  })
}

export function getCatalogStats() {
  const entries = ALL.map(toCatalogEntry)
  return {
    total: entries.length,
    available: entries.filter((e) => e.available).length,
    unavailable: entries.filter((e) => !e.available).length,
    categories: CATEGORY_ORDER.length,
  }
}
