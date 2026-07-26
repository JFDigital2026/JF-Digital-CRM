import type { DateRange, Granularity } from '@/lib/metrics'
import type { MetricLoader } from '@/lib/metrics/loader'

// NOTE ON MODULE LAYOUT
// `lib/metrics.ts` (the shared date-range / bucketing helpers used by the six
// original /api/metrics routes) and this `lib/metrics/` directory coexist.
// `@/lib/metrics` resolves to the file; `@/lib/metrics/<name>` resolves into this
// directory. Existing imports are untouched by design.

export type MetricUnit =
  | 'currency'
  | 'percent'
  | 'number'
  | 'days'
  | 'hours'
  | 'ratio'
  | 'score'

export type MetricCategory =
  | 'outbound'
  | 'leads'
  | 'pipeline'
  | 'conversion'
  | 'activity'
  | 'revenue'
  | 'pricing'
  | 'delivery'
  | 'retention'
  | 'admin'
  | 'system'
  | 'marketing'

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  outbound: 'Outbound / Cold Email',
  leads: 'Lead Gen & List Quality',
  pipeline: 'Sales Pipeline',
  conversion: 'Conversion & Velocity',
  activity: 'Meetings & Activity',
  revenue: 'Revenue & Financial',
  pricing: 'Pricing & ROI Integrity',
  delivery: 'Delivery / Recovery Blueprint',
  retention: 'Client Health & Retention',
  admin: 'Admin & Cash',
  system: 'System & Automation Health',
  marketing: 'Marketing & Inbound',
}

export const CATEGORY_ORDER: MetricCategory[] = [
  'outbound',
  'leads',
  'pipeline',
  'conversion',
  'activity',
  'revenue',
  'pricing',
  'delivery',
  'retention',
  'admin',
  'system',
  'marketing',
]

/**
 * Why a metric can't be resolved yet. Surfaced to the picker so unavailable KPIs
 * are visible but honest, and to the renderer so the card says *why* instead of
 * showing a zero. A zero that means "no data source" is indistinguishable from a
 * zero that means "a bad week" — that is how a dashboard starts lying.
 */
export type UnavailableReason =
  | 'needs-delivery-tracking'
  | 'needs-stage-history'
  | 'needs-savings-field'
  | 'needs-commitment-field'
  | 'needs-manual-entry'
  | 'needs-target'
  | 'needs-outbound-sync'
  | 'needs-lead-gen-field'

export const UNAVAILABLE_LABELS: Record<UnavailableReason, string> = {
  'needs-delivery-tracking': 'Needs delivery stage tracking',
  'needs-stage-history': 'Needs stage transition history',
  'needs-savings-field': 'Needs annual savings on opportunities',
  'needs-commitment-field': 'Needs commitment length on subscriptions',
  'needs-manual-entry': 'Needs manual entry',
  'needs-target': 'Set a target in Settings → Metrics',
  'needs-outbound-sync': 'Waiting on the first Lead Gen sync',
  'needs-lead-gen-field': 'Needs an extra field from Lead Gen',
}

export type SeriesPoint = { date: string; value: number }

export interface SeriesContext {
  range: DateRange
  granularity: Granularity
}

export interface MetricDefinition {
  id: string
  label: string
  category: MetricCategory
  unit: MetricUnit
  description: string

  /**
   * Direction that counts as good, for delta colouring. `false` means a rising
   * value is bad (churn, opt-out rate, no-show rate, cost per lead).
   */
  higherIsBetter?: boolean

  /**
   * True when the value describes the present moment rather than a window (MRR
   * from active subscriptions, count of open opportunities, queue depth). The
   * resolve endpoint skips the previous-period pass for these, because running
   * the same range-independent query against an earlier window yields an
   * identical number and a fake 0% delta.
   */
  pointInTime?: boolean

  /** Why this metric can't resolve yet. Omit when it works. */
  unavailable?: UnavailableReason

  /**
   * `prev` is a loader scoped to the preceding window of equal length. Almost no
   * metric needs it — the resolve endpoint already runs this same function
   * against the previous window to produce the delta. It exists for the handful
   * of KPIs whose *definition* is a period-over-period comparison (growth rate),
   * which would otherwise be inexpressible.
   */
  resolve?: (loader: MetricLoader, prev: MetricLoader) => Promise<number | null>
  series?: (loader: MetricLoader, ctx: SeriesContext) => Promise<SeriesPoint[]>
}

export interface MetricResult {
  value: number | null
  previous?: number | null
  delta?: number | null
  series?: SeriesPoint[]
  unavailable?: UnavailableReason
}

/** Registry entry as sent to the picker — definition metadata, no values. */
export interface MetricCatalogEntry {
  id: string
  label: string
  category: MetricCategory
  categoryLabel: string
  unit: MetricUnit
  description: string
  higherIsBetter: boolean
  supportsTrend: boolean
  available: boolean
  unavailableReason?: UnavailableReason
  unavailableLabel?: string
}
