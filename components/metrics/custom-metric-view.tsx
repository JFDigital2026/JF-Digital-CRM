'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Mail, Users, Kanban, Target, Calendar, DollarSign, Scale,
  Wrench, HeartHandshake, FileText, Activity, Megaphone,
  Lock, AlertTriangle, type LucideIcon,
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { formatMetricValue, deltaDirection } from '@/lib/metrics/format'
import type { MetricCatalogEntry, MetricCategory, MetricUnit } from '@/lib/metrics/types'

const CATEGORY_ICONS: Record<MetricCategory, LucideIcon> = {
  outbound: Mail,
  leads: Users,
  pipeline: Kanban,
  conversion: Target,
  activity: Calendar,
  revenue: DollarSign,
  pricing: Scale,
  delivery: Wrench,
  retention: HeartHandshake,
  admin: FileText,
  system: Activity,
  marketing: Megaphone,
}

const CHART_COLOR = '#415A77'

export interface CustomViewItem {
  metricId: string
  order: number
  showTrend: boolean
}

export interface CustomViewDefinition {
  id: string
  name: string
  slug: string
  description: string | null
  items: CustomViewItem[]
}

interface ResolveResult {
  value: number | null
  previous?: number | null
  delta?: number | null
  series?: { date: string; value: number }[]
  unavailable?: string
}

interface Props {
  view: CustomViewDefinition
  catalog: MetricCatalogEntry[]
  range: { from: string; to: string }
  unavailableLabels: Record<string, string>
}

/**
 * Renders a saved view: stat cards in the saved order, then a trend chart for
 * each metric flagged showTrend.
 *
 * Three degraded states are handled explicitly, because all three will occur:
 * a metric whose data source doesn't exist yet, a metric id no longer present in
 * the registry, and a view with no metrics at all. None of them render a zero.
 */
export function CustomMetricView({ view, catalog, range, unavailableLabels }: Props) {
  const [results, setResults] = useState<Record<string, ResolveResult>>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const byId = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog])

  const items = useMemo(
    () => [...view.items].sort((a, b) => a.order - b.order),
    [view.items]
  )

  const metricIds = useMemo(() => items.map((i) => i.metricId), [items])
  const trendIds = useMemo(
    () => items.filter((i) => i.showTrend).map((i) => i.metricId),
    [items]
  )

  const idsKey = metricIds.join(',')
  const trendKey = trendIds.join(',')

  const fetchResults = useCallback(async () => {
    if (!metricIds.length) {
      setResults({})
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      // One request for the whole view — the loader deduplicates the underlying
      // queries, so twelve revenue KPIs hit the orders table once.
      const res = await fetch('/api/metrics/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricIds,
          trendIds,
          from: range.from,
          to: range.to,
        }),
      })
      if (!res.ok) {
        setFailed(true)
        return
      }
      const data = await res.json()
      setResults(data.results ?? {})
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
    // idsKey/trendKey keep the dependency stable across array identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, trendKey, range.from, range.to])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium" style={{ color: '#1B263B' }}>
          {view.name} has no metrics yet
        </p>
        <p className="text-sm mt-1" style={{ color: '#778DA9' }}>
          Add KPIs to this view in{' '}
          <Link href={`/settings/metrics/${view.id}`} style={{ color: '#415A77' }}>
            Settings → Metrics
          </Link>
          .
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((i) => (
          <div key={i.metricId} className="h-28 rounded-2xl bg-gray-50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (failed) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: '#778DA9' }}>
        Could not load this view.
      </div>
    )
  }

  const trendItems = items.filter((i) => {
    const r = results[i.metricId]
    return i.showTrend && r?.series && r.series.length > 0
  })

  return (
    <div className="space-y-6">
      {view.description && (
        <p className="text-sm -mt-2" style={{ color: '#778DA9' }}>
          {view.description}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const meta = byId.get(item.metricId)
          const result = results[item.metricId]

          // A saved id the registry no longer knows about. Degrade, don't crash.
          if (!meta) {
            return (
              <UnavailableCard
                key={item.metricId}
                icon={AlertTriangle}
                label={item.metricId}
                reason="No longer in the metric catalog"
              />
            )
          }

          const Icon = CATEGORY_ICONS[meta.category] ?? Activity

          if (!meta.available || result?.unavailable) {
            const reasonKey = result?.unavailable ?? meta.unavailableReason
            return (
              <UnavailableCard
                key={item.metricId}
                icon={Lock}
                label={meta.label}
                reason={
                  (reasonKey ? unavailableLabels[reasonKey] : undefined) ??
                  meta.unavailableLabel ??
                  'No data source yet'
                }
              />
            )
          }

          return (
            <StatCard
              key={item.metricId}
              icon={Icon}
              label={meta.label}
              value={formatMetricValue(result?.value, meta.unit as MetricUnit)}
              trend={deltaDirection(result?.delta, meta.higherIsBetter)}
            />
          )
        })}
      </div>

      {trendItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trendItems.map((item) => {
            const meta = byId.get(item.metricId)
            const series = results[item.metricId]?.series ?? []
            if (!meta) return null
            return (
              <div
                key={item.metricId}
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.70)',
                  border: '1px solid rgba(255,255,255,0.55)',
                  boxShadow: '0 1px 2px rgba(13,27,42,0.04), 0 4px 16px rgba(13,27,42,0.06)',
                }}
              >
                <p className="text-sm font-semibold mb-4" style={{ color: '#1B263B' }}>
                  {meta.label}
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,27,42,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#778DA9' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#778DA9' }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v: number) => formatMetricValue(v, meta.unit as MetricUnit)}
                    />
                    <Tooltip
                      formatter={(v) => formatMetricValue(Number(v), meta.unit as MetricUnit)}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(13,27,42,0.08)',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLOR}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * A metric with no data source. Deliberately shows an em dash and the reason —
 * never 0, which would read as a real business result.
 */
function UnavailableCard({
  icon: Icon,
  label,
  reason,
}: {
  icon: LucideIcon
  label: string
  reason: string
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.45)',
        border: '1px dashed rgba(13,27,42,0.14)',
      }}
    >
      <div className="p-2 rounded-xl w-fit" style={{ background: 'rgba(13,27,42,0.05)' }}>
        <Icon size={18} style={{ color: '#A8B2C1' }} />
      </div>
      <div>
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: '#A8B2C1', letterSpacing: '0.04em' }}
        >
          {label}
        </p>
        <p className="mt-0.5 font-bold" style={{ fontSize: 28, color: '#C6CCD6', lineHeight: 1.2 }}>
          —
        </p>
        <p className="text-xs mt-1 leading-snug" style={{ color: '#A8B2C1' }}>
          {reason}
        </p>
      </div>
    </div>
  )
}
