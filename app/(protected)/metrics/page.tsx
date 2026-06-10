'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from 'recharts'
import {
  DollarSign, TrendingUp, Target, Percent, ArrowUpRight,
  ArrowDownRight, Users, RefreshCw, Activity, Calendar,
  BarChart2, Download, ChevronDown,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { TabGroup } from '@/components/ui/tab-group'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRangeKey = 'this_month' | 'last_month' | 'last_90' | 'last_12m' | 'custom'

interface DateRange { from: string; to: string }

interface OverviewData {
  totalRevenue: number
  mrr: number
  avgDealSize: number
  winRate: number
  leadToOppRate: number
  oppToCloseRate: number
  retentionRate: number
  churnRate: number
}

interface RevenueData {
  kpis: {
    totalRevenue: number; mrr: number; arr: number; acv: number; avgDealSize: number
    newBizRevenue: number; expansionRevenue: number; repeatRevenue: number
    grossProfit: number; salesGrowthRate: number | null
  }
  revenueOverTime: { date: string; value: number }[]
  revenueByProduct: { name: string; value: number }[]
  mrrTrend: { date: string; value: number }[]
  granularity: string
}

interface PipelineData {
  kpis: {
    totalPipelineValue: number; pipelineCoverageRatio: number | null
    leadToOppRate: number; oppToCloseRate: number; qualifiedLeads: number
    newOppsCount: number; avgLeadAge: number
  }
  valueByStage: { name: string; value: number; count: number }[]
  oppsOverTime: { date: string; value: number }[]
  stageFunnel: { name: string; value: number; fill: string }[]
  granularity: string
}

interface ActivityData {
  kpis: {
    emailsSent: number; smsSent: number; meetingsBooked: number; showRate: number
    meetingsCompleted: number; demosDelivered: number; followUpRate: number; responseTime: number | null
  }
  activityByType: { date: string; emails: number; sms: number; meetings: number; tasks: number }[]
  activityByDay: { name: string; value: number }[]
  granularity: string
}

interface ConversionData {
  kpis: { leadConversionRate: number; demoToCloseRate: number; quoteToCloseRate: number; winRate: number; oppToCloseRate: number }
  conversionFunnel: { name: string; value: number; fill: string }[]
  winLossBySource: { name: string; won: number; lost: number }[]
}

interface RetentionData {
  kpis: { retentionRate: number; churnRate: number; grr: number; nrr: number; ltv: number; expansionRate: number; renewalRate: number; saveRate: number }
  churnOverTime: { date: string; value: number }[]
  ltvByCohort: { cohort: string; ltv: number }[]
  granularity: string
}

interface QualityData {
  kpis: {
    leadQualityScore: number; oppQuality: number; qualifiedLeadRate: number; disqualRate: number
    noShowRate: number; proposalAcceptRate: number; discountRate: number; avgSellingPrice: number
    salesCycleCompletionRate: number; salesCycleDays: number
  }
  noShowTrend: { date: string; value: number }[]
  leadQualityOverTime: { date: string; value: number }[]
  granularity: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'activity', label: 'Activity' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'retention', label: 'Retention' },
  { key: 'quality', label: 'Quality' },
]

const CHART_COLORS = ['#415A77', '#0D1B2A', '#778DA9', '#A8B2C1', '#D4D8DE', '#6B7FA3']

const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_90', label: 'Last 90 Days' },
  { key: 'last_12m', label: 'Last 12 Months' },
  { key: 'custom', label: 'Custom Range' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRange(key: DateRangeKey, custom?: DateRange): DateRange {
  const now = new Date()
  if (key === 'this_month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }
  if (key === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }
  if (key === 'last_90') {
    const d = new Date(now); d.setDate(d.getDate() - 90)
    return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }
  if (key === 'last_12m') {
    const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
    return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }
  return custom ?? { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return `${n.toFixed(decimals)}%`
}

function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

function exportCSV(kpis: Record<string, number | null | undefined>, tabName: string, range: DateRange) {
  const rows = [['Metric', 'Value'], ...Object.entries(kpis).map(([k, v]) => [k, v != null ? String(v) : '—'])]
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `metrics-${tabName}-${range.from}_${range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}>
      <div className="px-5 py-3.5 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function NoData() {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-gray-400">No data for this period</div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-600 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{typeof p.value === 'number' && p.value > 1000 ? fmtMoney(p.value) : p.value?.toFixed?.(1) ?? p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Tab Sections ─────────────────────────────────────────────────────────────

function RevenueSection({ data }: { data: RevenueData }) {
  const { kpis, revenueOverTime = [], revenueByProduct = [], mrrTrend = [] } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile label="Total Revenue" value={fmtMoney(kpis.totalRevenue)} />
        <KpiTile label="MRR" value={fmtMoney(kpis.mrr)} />
        <KpiTile label="ARR" value={fmtMoney(kpis.arr)} />
        <KpiTile label="ACV" value={fmtMoney(kpis.acv)} />
        <KpiTile label="Avg Deal Size" value={fmtMoney(kpis.avgDealSize)} />
        <KpiTile label="New Business" value={fmtMoney(kpis.newBizRevenue)} />
        <KpiTile label="Expansion" value={fmtMoney(kpis.expansionRevenue)} />
        <KpiTile label="Repeat Business" value={fmtMoney(kpis.repeatRevenue)} />
        <KpiTile label="Gross Profit" value={fmtMoney(kpis.grossProfit)} />
        <KpiTile label="Sales Growth" value={kpis.salesGrowthRate != null ? fmtPct(kpis.salesGrowthRate) : '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue Over Time">
          {revenueOverTime.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtMoney} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="Revenue" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Product">
          {revenueByProduct.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByProduct} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtMoney} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="MRR Trend">
        {mrrTrend.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mrrTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtMoney} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" name="MRR" stroke={CHART_COLORS[0]} fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

function PipelineSection({ data }: { data: PipelineData }) {
  const { kpis, valueByStage = [], oppsOverTime = [], stageFunnel = [] } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiTile label="Pipeline Value" value={fmtMoney(kpis.totalPipelineValue)} />
        <KpiTile label="Coverage Ratio" value={kpis.pipelineCoverageRatio != null ? `${kpis.pipelineCoverageRatio.toFixed(1)}×` : '—'} />
        <KpiTile label="Lead → Opp" value={fmtPct(kpis.leadToOppRate)} />
        <KpiTile label="Opp → Close" value={fmtPct(kpis.oppToCloseRate)} />
        <KpiTile label="Qualified Leads" value={fmtNum(kpis.qualifiedLeads)} />
        <KpiTile label="New Opps" value={fmtNum(kpis.newOppsCount)} />
        <KpiTile label="Avg Lead Age" value={`${fmtNum(kpis.avgLeadAge, 1)} days`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Pipeline Value by Stage">
          {valueByStage.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={valueByStage} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtMoney} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Opportunities Created">
          {oppsOverTime.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={oppsOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="Opportunities" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Stage Conversion Funnel">
        {stageFunnel.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={200}>
            <FunnelChart>
              <Tooltip content={<CustomTooltip />} />
              <Funnel dataKey="value" data={stageFunnel} isAnimationActive>
                <LabelList position="center" fill="#fff" stroke="none" dataKey="name" style={{ fontSize: 12, fontWeight: 600 }} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

function ActivitySection({ data }: { data: ActivityData }) {
  const { kpis, activityByType = [], activityByDay = [] } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiTile label="Emails Sent" value={fmtNum(kpis.emailsSent)} />
        <KpiTile label="SMS Sent" value={fmtNum(kpis.smsSent)} />
        <KpiTile label="Meetings Booked" value={fmtNum(kpis.meetingsBooked)} />
        <KpiTile label="Show Rate" value={fmtPct(kpis.showRate)} />
        <KpiTile label="Meetings Completed" value={fmtNum(kpis.meetingsCompleted)} />
        <KpiTile label="Demos Delivered" value={fmtNum(kpis.demosDelivered)} />
        <KpiTile label="Follow-up Rate" value={fmtPct(kpis.followUpRate)} />
        <KpiTile label="Response Time" value={kpis.responseTime != null ? `${kpis.responseTime}h` : '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Activity by Type Over Time">
          {activityByType.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={activityByType} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="emails" name="Emails" stackId="a" fill={CHART_COLORS[0]} />
                <Bar dataKey="sms" name="SMS" stackId="a" fill={CHART_COLORS[2]} />
                <Bar dataKey="meetings" name="Meetings" stackId="a" fill={CHART_COLORS[1]} />
                <Bar dataKey="tasks" name="Tasks" stackId="a" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Activity by Day of Week">
          {activityByDay.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={activityByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Activity" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]}>
                  {activityByDay.map((entry, i) => {
                    const maxVal = activityByDay.length > 0 ? Math.max(...activityByDay.map((d) => d.value)) : 0
                    return <Cell key={i} fill={entry.value === maxVal && maxVal > 0 ? CHART_COLORS[1] : CHART_COLORS[0]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function ConversionSection({ data }: { data: ConversionData }) {
  const { kpis, conversionFunnel = [], winLossBySource = [] } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile label="Lead Conversion" value={fmtPct(kpis.leadConversionRate)} />
        <KpiTile label="Demo-to-Close" value={fmtPct(kpis.demoToCloseRate)} />
        <KpiTile label="Quote-to-Close" value={fmtPct(kpis.quoteToCloseRate)} />
        <KpiTile label="Win Rate" value={fmtPct(kpis.winRate)} />
        <KpiTile label="Opp-to-Close" value={fmtPct(kpis.oppToCloseRate)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Conversion Funnel">
          {conversionFunnel.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <FunnelChart>
                <Tooltip content={<CustomTooltip />} />
                <Funnel dataKey="value" data={conversionFunnel} isAnimationActive>
                  <LabelList position="center" fill="#fff" stroke="none" dataKey="name" style={{ fontSize: 12, fontWeight: 600 }} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Win/Loss by Source">
          {winLossBySource.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={winLossBySource} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="won" name="Won" fill={CHART_COLORS[0]} stackId="a" />
                <Bar dataKey="lost" name="Lost" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function RetentionSection({ data }: { data: RetentionData }) {
  const { kpis, churnOverTime = [], ltvByCohort = [] } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiTile label="Retention Rate" value={fmtPct(kpis.retentionRate)} />
        <KpiTile label="Churn Rate" value={fmtPct(kpis.churnRate)} />
        <KpiTile label="GRR" value={fmtPct(kpis.grr)} />
        <KpiTile label="NRR" value={fmtPct(kpis.nrr)} />
        <KpiTile label="LTV" value={fmtMoney(kpis.ltv)} />
        <KpiTile label="Expansion Rate" value={fmtPct(kpis.expansionRate)} />
        <KpiTile label="Renewal Rate" value={fmtPct(kpis.renewalRate)} />
        <KpiTile label="Save Rate" value={fmtPct(kpis.saveRate)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Churn Over Time">
          {churnOverTime.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={churnOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="Churned" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="LTV by Cohort">
          {ltvByCohort.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ltvByCohort} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="cohort" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtMoney} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ltv" name="LTV" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function QualitySection({ data }: { data: QualityData }) {
  const { kpis, noShowTrend = [], leadQualityOverTime = [] } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile label="Lead Quality Score" value={fmtNum(kpis.leadQualityScore, 1)} sub="/ 100" />
        <KpiTile label="Opp Quality" value={fmtPct(kpis.oppQuality)} />
        <KpiTile label="Qualified Lead Rate" value={fmtPct(kpis.qualifiedLeadRate)} />
        <KpiTile label="Disqualification Rate" value={fmtPct(kpis.disqualRate)} />
        <KpiTile label="No-Show Rate" value={fmtPct(kpis.noShowRate)} />
        <KpiTile label="Proposal Accept" value={fmtPct(kpis.proposalAcceptRate)} />
        <KpiTile label="Discount Rate" value={fmtPct(kpis.discountRate)} />
        <KpiTile label="Avg Selling Price" value={fmtMoney(kpis.avgSellingPrice)} />
        <KpiTile label="Cycle Completion" value={fmtPct(kpis.salesCycleCompletionRate)} />
        <KpiTile label="Sales Cycle" value={`${fmtNum(kpis.salesCycleDays, 1)} days`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="No-Show Rate Trend">
          {noShowTrend.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={noShowTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="No-Show %" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Lead Quality Over Time">
          {leadQualityOverTime.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={leadQualityOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="qualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Qualified Lead %" stroke={CHART_COLORS[0]} fill="url(#qualGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

function DateRangePicker({
  rangeKey, customRange, onChange, onCustomChange,
}: {
  rangeKey: DateRangeKey
  customRange: DateRange
  onChange: (key: DateRangeKey) => void
  onCustomChange: (range: DateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = RANGE_OPTIONS.find((o) => o.key === rangeKey)?.label ?? 'Custom Range'

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Calendar size={14} className="text-gray-400" />
        {label}
        <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[220px] rounded-2xl border border-gray-100 bg-white shadow-xl p-1.5">
          {RANGE_OPTIONS.filter((o) => o.key !== 'custom').map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
                rangeKey === opt.key ? 'bg-[#0D1B2A] text-white font-medium' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              {opt.label}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Custom Range</p>
            <div className="px-2 pb-2 space-y-1.5">
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => onCustomChange({ ...customRange, from: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#415A77]/30"
              />
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => { onCustomChange({ ...customRange, to: e.target.value }); onChange('custom') }}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#415A77]/30"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('this_month')
  const [customRange, setCustomRange] = useState<DateRange>(() => computeRange('this_month'))
  const [activeTab, setActiveTab] = useState('revenue')
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [tabData, setTabData] = useState<RevenueData | PipelineData | ActivityData | ConversionData | RetentionData | QualityData | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingTab, setLoadingTab] = useState(true)

  const range = rangeKey === 'custom' ? customRange : computeRange(rangeKey)
  const qs = `from=${range.from}&to=${range.to}`

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true)
    try {
      const res = await fetch(`/api/metrics/overview?${qs}`)
      if (res.ok) setOverview(await res.json())
    } finally { setLoadingOverview(false) }
  }, [qs])

  const fetchTab = useCallback(async () => {
    setLoadingTab(true)
    setTabData(null)
    try {
      const res = await fetch(`/api/metrics/${activeTab}?${qs}`)
      if (res.ok) setTabData(await res.json())
    } finally { setLoadingTab(false) }
  }, [activeTab, qs])

  useEffect(() => { fetchOverview() }, [fetchOverview])
  useEffect(() => { fetchTab() }, [fetchTab])

  const handleExport = () => {
    if (!tabData) return
    const kpisRaw = (tabData as { kpis: Record<string, number | null | undefined> }).kpis
    if (kpisRaw) exportCSV(kpisRaw, activeTab, range)
  }

  const ov = overview

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Metrics"
        subtitle="Real-time performance across revenue, pipeline, and activity"
        actions={
          <>
            <DateRangePicker
              rangeKey={rangeKey}
              customRange={customRange}
              onChange={setRangeKey}
              onCustomChange={(r) => { setCustomRange(r); setRangeKey('custom') }}
            />
            <button
              onClick={handleExport}
              disabled={!tabData}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          </>
        }
      />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loadingOverview ? (
          [...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-card bg-gray-50 animate-pulse" />)
        ) : (
          <>
            <StatCard icon={DollarSign} label="Total Revenue" value={fmtMoney(ov?.totalRevenue)} trend={undefined} />
            <StatCard icon={TrendingUp} label="MRR" value={fmtMoney(ov?.mrr)} trend={undefined} />
            <StatCard icon={BarChart2} label="Avg Deal Size" value={fmtMoney(ov?.avgDealSize)} trend={undefined} />
            <StatCard icon={Percent} label="Win Rate" value={fmtPct(ov?.winRate)} trend={undefined} />
            <StatCard icon={ArrowUpRight} label="Lead → Opp" value={fmtPct(ov?.leadToOppRate)} trend={undefined} />
            <StatCard icon={Target} label="Opp → Close" value={fmtPct(ov?.oppToCloseRate)} trend={undefined} />
            <StatCard icon={Users} label="Retention Rate" value={fmtPct(ov?.retentionRate)} trend={undefined} />
            <StatCard icon={ArrowDownRight} label="Churn Rate" value={fmtPct(ov?.churnRate)} trend={undefined} />
          </>
        )}
      </div>

      {/* Tab navigation */}
      <TabGroup tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Tab content */}
      {loadingTab ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-50 animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-gray-50 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'revenue' && tabData && <RevenueSection data={tabData as RevenueData} />}
          {activeTab === 'pipeline' && tabData && <PipelineSection data={tabData as PipelineData} />}
          {activeTab === 'activity' && tabData && <ActivitySection data={tabData as ActivityData} />}
          {activeTab === 'conversion' && tabData && <ConversionSection data={tabData as ConversionData} />}
          {activeTab === 'retention' && tabData && <RetentionSection data={tabData as RetentionData} />}
          {activeTab === 'quality' && tabData && <QualitySection data={tabData as QualityData} />}
          {!tabData && !loadingTab && <div className="py-16 text-center text-sm text-gray-400">Failed to load data</div>}
        </>
      )}
    </div>
  )
}
