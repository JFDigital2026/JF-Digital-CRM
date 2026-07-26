import { prisma } from '@/lib/prisma'
import type { CustomMetric } from '@prisma/client'
import type {
  MetricCategory,
  MetricDefinition,
  MetricUnit,
  SeriesPoint,
} from '@/lib/metrics/types'
import type { MetricLoader } from '@/lib/metrics/loader'
import { sumSeries } from '@/lib/metrics/util'
import {
  AGGREGATION_LABELS,
  VALID_CATEGORIES,
  VALID_UNITS,
  aggregateValues,
  customMetricId,
  isCustomMetricId,
  keyFromCustomMetricId,
} from '@/lib/metrics/custom'

// Server-only. Anything importing this pulls in Prisma, so client components
// must import from custom.ts instead.

/**
 * Turn a CustomMetric row into a MetricDefinition the registry can resolve.
 *
 * The resolver is a fixed aggregate over that metric's own values, parameterised
 * by id. Nothing in the row is ever interpolated into a query, so a user-created
 * metric carries exactly the same safety guarantee as a code-defined one.
 */
export function toMetricDefinition(row: CustomMetric): MetricDefinition {
  return {
    id: customMetricId(row.key),
    label: row.label,
    category: (VALID_CATEGORIES.includes(row.category as MetricCategory)
      ? row.category
      : 'custom') as MetricCategory,
    unit: (VALID_UNITS.includes(row.unit as MetricUnit) ? row.unit : 'number') as MetricUnit,
    description: row.description || AGGREGATION_LABELS[row.aggregation],
    higherIsBetter: row.higherIsBetter,
    // LATEST describes a standing figure, not a total accrued over the window,
    // so comparing it against the previous window would be misleading.
    pointInTime: row.aggregation === 'LATEST',

    resolve: async (loader: MetricLoader) => {
      if (row.aggregation === 'LATEST') {
        const latest = await loader.customValuesLatest()
        const hit = latest.find((v) => v.customMetricId === row.id)
        return hit ? hit.value : null
      }
      const rows = await loader.customValuesInWindow()
      const values = rows.filter((v) => v.customMetricId === row.id).map((v) => v.value)
      return aggregateValues(values, row.aggregation)
    },

    series: async (loader: MetricLoader, ctx): Promise<SeriesPoint[]> => {
      const rows = await loader.customValuesInWindow()
      const mine = rows.filter((v) => v.customMetricId === row.id)
      return sumSeries(
        mine.map((v) => ({ date: v.date, value: v.value })),
        ctx
      )
    },
  }
}

let cache: { at: number; rows: CustomMetric[] } | null = null
const CACHE_MS = 5_000

/**
 * Custom metric rows, briefly cached.
 *
 * A single page load asks for the catalog and then resolves a view, and both
 * paths need these rows. The window is short enough that a metric created in one
 * tab shows up in another almost immediately, and every write path clears it.
 */
export async function getCustomMetricRows(): Promise<CustomMetric[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows
  const rows = await prisma.customMetric.findMany({ orderBy: { label: 'asc' } })
  cache = { at: Date.now(), rows }
  return rows
}

export function invalidateCustomMetricCache(): void {
  cache = null
}

export async function getCustomMetricDefinitions(): Promise<MetricDefinition[]> {
  return (await getCustomMetricRows()).map(toMetricDefinition)
}

export async function findCustomMetricDefinition(
  id: string
): Promise<MetricDefinition | undefined> {
  if (!isCustomMetricId(id)) return undefined
  const key = keyFromCustomMetricId(id)
  const row = (await getCustomMetricRows()).find((r) => r.key === key)
  return row ? toMetricDefinition(row) : undefined
}
