import type { MetricUnit } from '@/lib/metrics/types'

// Client-safe. Imports nothing that reaches Prisma.

export function formatMetricValue(
  value: number | null | undefined,
  unit: MetricUnit
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'

  switch (unit) {
    case 'currency': {
      const abs = Math.abs(value)
      if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
      if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
      return `$${value.toFixed(0)}`
    }
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'ratio':
      return `${value.toFixed(2)}×`
    case 'days':
      return `${value.toFixed(value < 10 ? 1 : 0)}d`
    case 'hours':
      if (value >= 48) return `${(value / 24).toFixed(1)}d`
      return `${value.toFixed(1)}h`
    case 'score':
      return value.toFixed(1)
    case 'number':
    default:
      if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}k`
      return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }
}

/**
 * Delta direction for colouring. Returns null when there is nothing meaningful
 * to show, so the card renders no trend chip rather than a green 0%.
 */
export function deltaDirection(
  delta: number | null | undefined,
  higherIsBetter: boolean
): { value: number; direction: 'up' | 'down' } | undefined {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return undefined
  if (Math.abs(delta) < 0.05) return undefined
  const improving = delta > 0 ? higherIsBetter : !higherIsBetter
  return { value: Math.round(delta * 10) / 10, direction: improving ? 'up' : 'down' }
}
