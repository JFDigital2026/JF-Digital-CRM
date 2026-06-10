export type DateRange = { from: Date; to: Date }
export type Granularity = 'day' | 'week' | 'month'

export function parseRange(from: string | null, to: string | null): DateRange {
  const now = new Date()
  const f = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const t = to ? new Date(to) : new Date(now)
  t.setHours(23, 59, 59, 999)
  return { from: f, to: t }
}

export function getGranularity(range: DateRange): Granularity {
  const days = (range.to.getTime() - range.from.getTime()) / 86_400_000
  if (days <= 35) return 'day'
  if (days <= 90) return 'week'
  return 'month'
}

function weekStart(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(copy.getFullYear(), copy.getMonth(), diff)
}

export function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === 'day') return date.toISOString().slice(0, 10)
  if (granularity === 'week') return weekStart(new Date(date)).toISOString().slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function fillTimeSeries(
  range: DateRange,
  granularity: Granularity,
  data: Record<string, number>
): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = []
  const cursor = new Date(range.from)
  cursor.setHours(0, 0, 0, 0)
  const seen = new Set<string>()

  while (cursor <= range.to) {
    const key = bucketKey(cursor, granularity)
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ date: key, value: data[key] ?? 0 })
    }
    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1)
    else if (granularity === 'week') cursor.setDate(cursor.getDate() + 7)
    else cursor.setMonth(cursor.getMonth() + 1)
  }
  return result
}

export function fillMultiTimeSeries<K extends string>(
  range: DateRange,
  granularity: Granularity,
  data: Record<string, Partial<Record<K, number>>>,
  keys: K[]
): ({ date: string } & Record<K, number>)[] {
  const result: ({ date: string } & Record<K, number>)[] = []
  const cursor = new Date(range.from)
  cursor.setHours(0, 0, 0, 0)
  const seen = new Set<string>()

  while (cursor <= range.to) {
    const key = bucketKey(cursor, granularity)
    if (!seen.has(key)) {
      seen.add(key)
      const entry: Record<string, number | string> = { date: key }
      for (const k of keys) entry[k as string] = data[key]?.[k] ?? 0
      result.push(entry as { date: string } & Record<K, number>)
    }
    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1)
    else if (granularity === 'week') cursor.setDate(cursor.getDate() + 7)
    else cursor.setMonth(cursor.getMonth() + 1)
  }
  return result
}

export function fmtDate(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr)
  if (granularity === 'month') return d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
  if (granularity === 'week') return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

export function monthlySubValue(
  product: { price: number; interval: string | null; intervalCount?: number | null },
  customAmount?: number | null
): number {
  const price = customAmount ?? product.price
  if (!product.interval) return 0
  if (product.interval === 'MONTHLY') return price
  if (product.interval === 'ANNUAL' || product.interval === 'YEARLY') return price / 12
  if (product.interval === 'BI_WEEKLY') return price * 2.17
  return price
}
