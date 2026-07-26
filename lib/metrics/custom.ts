import type { MetricAggregation } from '@prisma/client'
import type { MetricUnit } from '@/lib/metrics/types'
import { CATEGORY_ORDER } from '@/lib/metrics/types'

// Client-safe. Constants and pure helpers only — nothing here reaches Prisma, so
// the create/record modals can import it without pulling the database client
// into the browser bundle. Database-backed lookups live in custom-server.ts.

/** Every id a user-created metric can have is namespaced, so it can never
 *  collide with or shadow a code-defined metric. */
export const CUSTOM_PREFIX = 'custom.'

export function customMetricId(key: string): string {
  return `${CUSTOM_PREFIX}${key}`
}

export function isCustomMetricId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX)
}

export function keyFromCustomMetricId(id: string): string {
  return id.slice(CUSTOM_PREFIX.length)
}

export const AGGREGATION_LABELS: Record<MetricAggregation, string> = {
  SUM: 'Total over the period',
  AVERAGE: 'Average of recorded values',
  LATEST: 'Most recent value',
  MAX: 'Highest value',
  MIN: 'Lowest value',
}

export const AGGREGATION_HELP: Record<MetricAggregation, string> = {
  SUM: 'Adds every entry in the range. Right for counts of things you did — requests sent, posts published.',
  AVERAGE: 'Means the entries. Right for rates and scores, where adding them would be meaningless.',
  LATEST: 'Takes the newest entry, looking back before the range if needed. Right for standing figures — headcount, a balance.',
  MAX: 'Highest entry in the range.',
  MIN: 'Lowest entry in the range.',
}

export const UNIT_OPTIONS: { value: MetricUnit; label: string; example: string }[] = [
  { value: 'number', label: 'Number', example: '42' },
  { value: 'percent', label: 'Percentage', example: '42.0%' },
  { value: 'currency', label: 'Currency', example: '$4.2k' },
  { value: 'days', label: 'Days', example: '4.2d' },
  { value: 'hours', label: 'Hours', example: '4.2h' },
  { value: 'ratio', label: 'Ratio', example: '4.20×' },
  { value: 'score', label: 'Score', example: '4.2' },
]

export const VALID_UNITS = UNIT_OPTIONS.map((u) => u.value)
export const VALID_AGGREGATIONS: MetricAggregation[] = ['SUM', 'AVERAGE', 'LATEST', 'MAX', 'MIN']
export const VALID_CATEGORIES = CATEGORY_ORDER

/** Slugify a label into a stable, url-safe key. */
export function slugifyMetricKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'metric'
  )
}

export function aggregateValues(
  values: number[],
  aggregation: MetricAggregation
): number | null {
  if (!values.length) return null
  switch (aggregation) {
    case 'SUM':
      return values.reduce((s, v) => s + v, 0)
    case 'AVERAGE':
      return values.reduce((s, v) => s + v, 0) / values.length
    case 'MAX':
      return Math.max(...values)
    case 'MIN':
      return Math.min(...values)
    case 'LATEST':
    default:
      return values[values.length - 1]
  }
}
