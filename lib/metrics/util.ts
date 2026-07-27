import { bucketKey, fillTimeSeries } from '@/lib/metrics'
import type { MetricLoader } from '@/lib/metrics/loader'
import type { SeriesContext, SeriesPoint } from '@/lib/metrics/types'

/**
 * Division that returns null rather than 0 when the denominator is empty.
 *
 * The distinction matters: a reply rate of 0% after 400 sends is a real result,
 * a reply rate with no sends at all is not a result. Returning 0 for the second
 * case makes an empty period look like a catastrophic one.
 */
export function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null
  return (numerator / denominator) * 100
}

/** Same contract as `rate`, without the ×100. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null
  return numerator / denominator
}

export function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0)
}

export function daysBetween(a: Date | string, b: Date | string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

/** Bucket a list of dated records into a filled time series by count. */
export function countSeries(
  records: { date: Date | string }[],
  ctx: SeriesContext
): SeriesPoint[] {
  const buckets: Record<string, number> = {}
  for (const r of records) {
    const key = bucketKey(new Date(r.date), ctx.granularity)
    buckets[key] = (buckets[key] ?? 0) + 1
  }
  return fillTimeSeries(ctx.range, ctx.granularity, buckets)
}

/** Bucket a list of dated records into a filled time series by summed value. */
export function sumSeries(
  records: { date: Date | string; value: number }[],
  ctx: SeriesContext
): SeriesPoint[] {
  const buckets: Record<string, number> = {}
  for (const r of records) {
    const key = bucketKey(new Date(r.date), ctx.granularity)
    buckets[key] = (buckets[key] ?? 0) + r.value
  }
  return fillTimeSeries(ctx.range, ctx.granularity, buckets)
}

/** Series of a rate — numerator and denominator bucketed separately, then divided. */
export function rateSeries(
  records: { date: Date | string; hit: boolean }[],
  ctx: SeriesContext
): SeriesPoint[] {
  const total: Record<string, number> = {}
  const hits: Record<string, number> = {}
  for (const r of records) {
    const key = bucketKey(new Date(r.date), ctx.granularity)
    total[key] = (total[key] ?? 0) + 1
    if (r.hit) hits[key] = (hits[key] ?? 0) + 1
  }
  const out: Record<string, number> = {}
  for (const key of Object.keys(total)) {
    out[key] = total[key] ? ((hits[key] ?? 0) / total[key]) * 100 : 0
  }
  return fillTimeSeries(ctx.range, ctx.granularity, out)
}

/** Outbound daily rows summed into a filled series over one numeric column. */
export async function outboundSeries(
  loader: MetricLoader,
  ctx: SeriesContext,
  pick: (row: {
    sent: number
    uniqueOpens: number
    totalOpens: number
    suppressedOpens: number
    replied: number
    positiveReplies: number
    optedOut: number
    bounced: number
    linkedinSent: number
  }) => number
): Promise<SeriesPoint[]> {
  const rows = await loader.outboundStats()
  return sumSeries(
    rows.map((r) => ({ date: r.date, value: pick(r) })),
    ctx
  )
}
