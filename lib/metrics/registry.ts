import { prisma } from '@/lib/prisma'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  UNAVAILABLE_LABELS,
  type MetricCatalogEntry,
  type MetricDefinition,
} from '@/lib/metrics/types'
import {
  findCustomMetricDefinition,
  getCustomMetricDefinitions,
  getCustomMetricRows,
} from '@/lib/metrics/custom-server'
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

// ─── Hybrid lookup: code registry + user-created metrics ─────────────────────
// Custom metrics live in the database but resolve through this same registry, so
// once created they are indistinguishable from a built-in metric everywhere
// downstream. Anything resolving an id from request input must use these async
// functions — the synchronous ones above see code metrics only.

/** Resolve any metric id, code-defined or user-created. */
export async function resolveMetricDefinition(
  id: string
): Promise<MetricDefinition | undefined> {
  const builtIn = METRIC_REGISTRY.get(id)
  if (builtIn) return builtIn
  return findCustomMetricDefinition(id)
}

/** Whether an id names a real metric. Used to reject unknown ids on write. */
export async function isKnownMetricAsync(id: string): Promise<boolean> {
  return (await resolveMetricDefinition(id)) !== undefined
}

/**
 * Full catalog for the picker: code metrics plus user-created ones.
 *
 * A custom metric with no values recorded yet is marked unavailable with a
 * "no values recorded" reason rather than dropped, so it is visible in the
 * picker and renders an em dash instead of a zero that would read as a real
 * result.
 */
export async function getFullCatalog(): Promise<MetricCatalogEntry[]> {
  const [rows, custom] = await Promise.all([
    getCustomMetricRows(),
    getCustomMetricDefinitions(),
  ])

  const counts = rows.length
    ? await prisma.customMetricValue.groupBy({
        by: ['customMetricId'],
        _count: { _all: true },
      })
    : []
  const countByMetric = new Map(counts.map((c) => [c.customMetricId, c._count._all]))

  const customEntries: MetricCatalogEntry[] = custom.map((def, index) => {
    const row = rows[index]
    const valueCount = countByMetric.get(row.id) ?? 0
    return {
      ...toCatalogEntry(def),
      available: valueCount > 0,
      unavailableReason: valueCount > 0 ? undefined : 'needs-values',
      unavailableLabel: valueCount > 0 ? undefined : UNAVAILABLE_LABELS['needs-values'],
      isCustom: true,
      customMetricId: row.id,
      aggregation: row.aggregation,
      valueCount,
    }
  })

  return [...getCatalog(), ...customEntries].sort((a, b) => {
    const byCategory =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    return byCategory !== 0 ? byCategory : a.label.localeCompare(b.label)
  })
}

export async function getFullCatalogStats() {
  const entries = await getFullCatalog()
  return {
    total: entries.length,
    available: entries.filter((e) => e.available).length,
    unavailable: entries.filter((e) => !e.available).length,
    custom: entries.filter((e) => e.isCustom).length,
    categories: CATEGORY_ORDER.length,
  }
}
