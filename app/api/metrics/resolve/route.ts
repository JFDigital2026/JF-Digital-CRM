import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/permissions'
import { parseRange, getGranularity } from '@/lib/metrics'
import { MetricLoader } from '@/lib/metrics/loader'
import { resolveMetricDefinition } from '@/lib/metrics/registry'
import type { MetricResult } from '@/lib/metrics/types'

const MAX_METRICS = 60

const bodySchema = z.object({
  metricIds: z.array(z.string().min(1)).min(1).max(MAX_METRICS),
  from: z.string().nullish(),
  to: z.string().nullish(),
  /** Metric ids that additionally want a time series for charting. */
  trendIds: z.array(z.string().min(1)).max(MAX_METRICS).optional(),
  compare: z.boolean().optional().default(true),
})

/**
 * Batch metric resolution.
 *
 * POST rather than GET because a view's id list plus a custom range overruns
 * comfortable URL length, and batched rather than one-endpoint-per-metric so a
 * twelve-KPI view is one round-trip whose underlying queries are deduplicated by
 * MetricLoader instead of twelve round-trips hitting the same three tables.
 */
export async function POST(req: Request) {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  let parsed
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { metricIds, from, to, trendIds = [], compare } = parsed

  const range = parseRange(from ?? null, to ?? null)
  const granularity = getGranularity(range)
  const periodMs = range.to.getTime() - range.from.getTime()
  const prevRange = {
    from: new Date(range.from.getTime() - periodMs),
    to: new Date(range.from.getTime()),
  }

  const loader = new MetricLoader(range)
  const prevLoader = new MetricLoader(prevRange)
  const trendSet = new Set(trendIds)

  // Resolve every id against the registry (code metrics plus user-created ones)
  // up front. Unknown ids never reach a query: a view holding an id that no
  // longer exists degrades to an "unavailable" card rather than failing the
  // whole request.
  const definitions = new Map(
    await Promise.all(
      metricIds.map(
        async (id) => [id, await resolveMetricDefinition(id)] as const
      )
    )
  )
  const unknown = metricIds.filter((id) => !definitions.get(id))

  const entries = await Promise.all(
    metricIds.map(async (id): Promise<[string, MetricResult]> => {
      const def = definitions.get(id)
      if (!def) return [id, { value: null, unavailable: 'needs-manual-entry' }]
      if (def.unavailable || !def.resolve) {
        return [id, { value: null, unavailable: def.unavailable ?? 'needs-manual-entry' }]
      }

      try {
        const value = await def.resolve(loader, prevLoader)

        // Point-in-time metrics ignore the window, so resolving them against an
        // earlier one returns the same number and a fake 0% delta. Skip it.
        const previous =
          compare && !def.pointInTime ? await def.resolve(prevLoader, loader) : null

        const delta =
          value !== null && previous !== null && previous !== 0
            ? ((value - previous) / Math.abs(previous)) * 100
            : null

        const series =
          trendSet.has(id) && def.series
            ? await def.series(loader, { range, granularity })
            : undefined

        return [id, { value, previous, delta, series }]
      } catch (error) {
        // One broken resolver must not blank the whole dashboard.
        console.error(`[metrics] resolver failed for ${id}:`, error)
        return [id, { value: null }]
      }
    })
  )

  return NextResponse.json({
    results: Object.fromEntries(entries),
    granularity,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    ...(unknown.length ? { unknownMetricIds: unknown } : {}),
  })
}
