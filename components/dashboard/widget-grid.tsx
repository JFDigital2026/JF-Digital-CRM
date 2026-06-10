'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, X, ChevronLeft, ChevronRight, Settings2, Plus, Save, CheckCircle2,
  TrendingUp, TrendingDown, DollarSign, Users, Calendar, Activity, Layers,
  Zap, CreditCard, CheckSquare, ArrowRight, Circle, SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type ColSize = 3 | 4 | 6 | 8 | 12
const COL_SIZES: ColSize[] = [3, 4, 6, 8, 12]

type LayoutItem = { id: string; cols: ColSize }

export type DashboardStats = {
  revenueThisMonth: number
  revenueLastMonth: number
  mrr: number
  openPipelineValue: number
  tasksDueToday: TaskItem[]
  newContactsThisMonth: number
  newContactsLastMonth: number
  appointmentsThisMonth: number
  appointmentShowRate: number
  recentActivity: ActivityItem[]
  pipelineSummary: PipelineSummary[]
  revenueTrend: { date: string; revenue: number }[]
  activeSubscriptions: number
  subscriptionMrr: number
  automationsThisMonth: number
  automationFailures: number
  upcomingTasks: TaskItem[]
}

type TaskItem = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  contact: { id: string; firstName: string; lastName: string } | null
}

type ActivityItem = {
  id: string
  type: string
  description: string
  createdAt: string
  contact: { id: string; firstName: string; lastName: string } | null
}

type PipelineSummary = {
  id: string
  name: string
  stages: { id: string; name: string; count: number; value: number }[]
}

// ─── Default layout ───────────────────────────────────────────────────────────

const ALL_WIDGETS: { id: string; label: string; defaultCols: ColSize }[] = [
  { id: 'revenue-month',       label: 'Revenue This Month',    defaultCols: 4 },
  { id: 'mrr',                 label: 'MRR',                   defaultCols: 4 },
  { id: 'pipeline-value',      label: 'Open Pipeline Value',   defaultCols: 4 },
  { id: 'tasks-due',           label: 'Tasks Due Today',       defaultCols: 6 },
  { id: 'new-contacts',        label: 'New Contacts',          defaultCols: 4 },
  { id: 'appointments',        label: 'Appointments',          defaultCols: 4 },
  { id: 'activity-feed',       label: 'Recent Activity',       defaultCols: 6 },
  { id: 'pipeline-summary',    label: 'Pipeline Summary',      defaultCols: 6 },
  { id: 'revenue-trend',       label: 'Revenue Trend',         defaultCols: 8 },
  { id: 'active-subs',         label: 'Active Subscriptions',  defaultCols: 4 },
  { id: 'automations',         label: 'Automations Triggered', defaultCols: 4 },
  { id: 'upcoming-tasks',      label: 'Upcoming Tasks',        defaultCols: 6 },
]

const DEFAULT_LAYOUT: LayoutItem[] = ALL_WIDGETS.map((w) => ({ id: w.id, cols: w.defaultCols }))

// ─── Widget categories ────────────────────────────────────────────────────────

const WIDGET_CATEGORIES: { label: string; widgetIds: string[] }[] = [
  {
    label: 'Revenue & Finance',
    widgetIds: ['revenue-month', 'mrr', 'revenue-trend', 'active-subs'],
  },
  {
    label: 'Pipeline',
    widgetIds: ['pipeline-value', 'pipeline-summary'],
  },
  {
    label: 'Tasks',
    widgetIds: ['tasks-due', 'upcoming-tasks'],
  },
  {
    label: 'Contacts',
    widgetIds: ['new-contacts'],
  },
  {
    label: 'Calendar',
    widgetIds: ['appointments'],
  },
  {
    label: 'Activity',
    widgetIds: ['activity-feed'],
  },
  {
    label: 'Automations',
    widgetIds: ['automations'],
  },
]

const STORAGE_KEY = 'crm-dashboard-layout-v1'

function loadLayout(): LayoutItem[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as { order: string[]; cols: Record<string, ColSize>; hidden: string[] }
    return parsed.order
      .filter((id) => !parsed.hidden.includes(id))
      .map((id) => ({ id, cols: parsed.cols[id] ?? (ALL_WIDGETS.find((w) => w.id === id)?.defaultCols ?? 4) }))
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayout(layout: LayoutItem[], hidden: string[]) {
  const data = {
    order: [...layout.map((i) => i.id), ...hidden],
    cols: Object.fromEntries(layout.map((i) => [i.id, i.cols])),
    hidden,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadHidden(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw).hidden ?? []
  } catch {
    return []
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0
  return Math.round(((current - prev) / prev) * 100)
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-gray-100 text-gray-500',
}

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  'contact.created': { icon: Users, color: 'text-blue-500 bg-blue-50' },
  'contact.updated': { icon: Users, color: 'text-blue-400 bg-blue-50' },
  'task.created': { icon: CheckSquare, color: 'text-amber-500 bg-amber-50' },
  'task.completed': { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
  'opportunity.created': { icon: TrendingUp, color: 'text-purple-500 bg-purple-50' },
  'opportunity.stage_changed': { icon: Layers, color: 'text-purple-400 bg-purple-50' },
  'note.added': { icon: Activity, color: 'text-gray-500 bg-gray-50' },
  'message.sent': { icon: Activity, color: 'text-sky-500 bg-sky-50' },
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  sub,
  delta,
  loading,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  value: string
  sub?: string
  delta?: number
  loading: boolean
}) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', iconColor)}>
          <Icon size={17} />
        </div>
        {delta !== undefined && !loading && (
          <span className={cn('flex items-center gap-0.5 text-xs font-semibold', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2 mt-1">
          <div className="h-7 w-24 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-3.5 w-16 rounded bg-gray-100 animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </>
      )}
      <p className="text-xs font-medium text-gray-500 mt-auto pt-3">{label}</p>
    </div>
  )
}

// ─── Widget content renderers ─────────────────────────────────────────────────

function WidgetContent({
  id,
  stats,
  loading,
  onCompleteTask,
}: {
  id: string
  stats: DashboardStats | null
  loading: boolean
  onCompleteTask: (taskId: string) => void
}) {
  const [activePipelineIdx, setActivePipelineIdx] = useState(0)

  switch (id) {
    case 'revenue-month': {
      const delta = stats ? pct(stats.revenueThisMonth, stats.revenueLastMonth) : 0
      return (
        <StatCard
          icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600"
          label="Revenue This Month" value={stats ? fmt(stats.revenueThisMonth) : '—'}
          sub={stats ? `${fmt(stats.revenueLastMonth)} last month` : undefined}
          delta={delta} loading={loading}
        />
      )
    }

    case 'mrr': {
      return (
        <StatCard
          icon={TrendingUp} iconColor="bg-blue-50 text-blue-600"
          label="Monthly Recurring Revenue" value={stats ? fmt(stats.mrr) : '—'}
          sub={stats ? `${stats.activeSubscriptions} active subscriptions` : undefined}
          loading={loading}
        />
      )
    }

    case 'pipeline-value': {
      return (
        <StatCard
          icon={Layers} iconColor="bg-purple-50 text-purple-600"
          label="Open Pipeline Value" value={stats ? fmt(stats.openPipelineValue) : '—'}
          sub="All open opportunities" loading={loading}
        />
      )
    }

    case 'tasks-due': {
      const tasks = stats?.tasksDueToday ?? []
      return (
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Tasks Due Today</p>
            {!loading && (
              <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', tasks.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                {tasks.length}
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <CheckCircle2 size={28} className="text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-gray-600">All caught up!</p>
              <p className="text-xs text-gray-400 mt-0.5">No tasks due today.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-hidden">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 group rounded-lg hover:bg-gray-50 px-1 py-1 transition-colors">
                  <button
                    onClick={() => onCompleteTask(t.id)}
                    className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0 group-hover:border-emerald-400 transition-colors"
                  />
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                  {t.contact && (
                    <Link href={`/contacts/${t.contact.id}`} className="text-[10px] text-[#415A77] hover:underline shrink-0 truncate max-w-[80px]">
                      {t.contact.firstName} {t.contact.lastName}
                    </Link>
                  )}
                  <span className={cn('text-[9px] font-bold rounded px-1.5 py-0.5 shrink-0', PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500')}>
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/tasks" className="flex items-center gap-1 text-[11px] text-[#415A77] hover:underline mt-3 font-medium">
            View All Tasks <ArrowRight size={11} />
          </Link>
        </div>
      )
    }

    case 'new-contacts': {
      const delta = stats ? pct(stats.newContactsThisMonth, stats.newContactsLastMonth) : 0
      return (
        <StatCard
          icon={Users} iconColor="bg-sky-50 text-sky-600"
          label="New Contacts This Month"
          value={stats ? String(stats.newContactsThisMonth) : '—'}
          sub={stats ? `${stats.newContactsLastMonth} last month` : undefined}
          delta={delta} loading={loading}
        />
      )
    }

    case 'appointments': {
      return (
        <StatCard
          icon={Calendar} iconColor="bg-violet-50 text-violet-600"
          label="Appointments This Month"
          value={stats ? String(stats.appointmentsThisMonth) : '—'}
          sub={stats ? `${stats.appointmentShowRate}% show rate` : undefined}
          loading={loading}
        />
      )
    }

    case 'activity-feed': {
      const activity = stats?.recentActivity ?? []
      return (
        <div className="flex flex-col h-full p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</p>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="flex-1 space-y-1 overflow-hidden">
              {activity.map((a, i) => {
                const meta = ACTIVITY_ICONS[a.type] ?? { icon: Circle, color: 'text-gray-400 bg-gray-50' }
                const Icon = meta.icon
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 py-1.5 animate-[fadeSlideIn_0.3s_ease_both]"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5', meta.color)}>
                      <Icon size={11} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug truncate">{a.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {a.contact && (
                          <Link href={`/contacts/${a.contact.id}`} className="text-[10px] text-[#415A77] hover:underline shrink-0">
                            {a.contact.firstName} {a.contact.lastName}
                          </Link>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    case 'pipeline-summary': {
      const pipelines = stats?.pipelineSummary ?? []
      const pipeline = pipelines[activePipelineIdx]
      const totalCount = pipeline?.stages.reduce((s, st) => s + st.count, 0) ?? 0
      const STAGE_COLORS = ['#0D1B2A', '#1B263B', '#415A77', '#778DA9', '#A9B9CC', '#C9D6E3']

      return (
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Pipeline Summary</p>
            {pipelines.length > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setActivePipelineIdx((i) => Math.max(0, i - 1))} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30" disabled={activePipelineIdx === 0}>
                  <ChevronLeft size={13} />
                </button>
                <span className="text-[10px] text-gray-500 font-medium">{pipeline?.name}</span>
                <button onClick={() => setActivePipelineIdx((i) => Math.min(pipelines.length - 1, i + 1))} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30" disabled={activePipelineIdx === pipelines.length - 1}>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ) : !pipeline || totalCount === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400">No open opportunities</p>
            </div>
          ) : (
            <>
              <div className="flex rounded-lg overflow-hidden h-6 mb-3">
                {pipeline.stages.filter((s) => s.count > 0).map((s, i) => (
                  <div
                    key={s.id}
                    title={`${s.name}: ${s.count} deals · ${fmt(s.value)}`}
                    style={{ width: `${(s.count / totalCount) * 100}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                    className="transition-all first:rounded-l-lg last:rounded-r-lg"
                  />
                ))}
              </div>
              <div className="space-y-1">
                {pipeline.stages.filter((s) => s.count > 0).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />
                    <span className="text-gray-600 flex-1 truncate">{s.name}</span>
                    <span className="text-gray-400 shrink-0">{s.count}</span>
                    <span className="text-gray-500 font-medium shrink-0 w-16 text-right">{fmt(s.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }

    case 'revenue-trend': {
      const data = stats?.revenueTrend ?? []
      return (
        <div className="flex flex-col h-full p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Revenue — Last 30 Days</p>
          {loading ? (
            <div className="flex-1 rounded-lg bg-gray-100 animate-pulse" />
          ) : (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#415A77" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#415A77" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 10px' }}
                    formatter={(v: unknown) => [fmt(v as number), 'Revenue'] as [string, string]}
                    labelFormatter={(l: unknown) => new Date(l as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#415A77" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )
    }

    case 'active-subs': {
      return (
        <StatCard
          icon={CreditCard} iconColor="bg-teal-50 text-teal-600"
          label="Active Subscriptions"
          value={stats ? String(stats.activeSubscriptions) : '—'}
          sub={stats ? `${fmt(stats.subscriptionMrr)} MRR` : undefined}
          loading={loading}
        />
      )
    }

    case 'automations': {
      return (
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <Zap size={17} className="text-orange-500" />
            </div>
            {stats && stats.automationFailures > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                {stats.automationFailures} failed
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-7 w-16 rounded bg-gray-100 animate-pulse" />
              <div className="h-3.5 w-24 rounded bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{stats?.automationsThisMonth ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">triggered this month</p>
            </>
          )}
          <p className="text-xs font-medium text-gray-500 mt-auto pt-3">Automations</p>
        </div>
      )
    }

    case 'upcoming-tasks': {
      const tasks = stats?.upcomingTasks ?? []
      return (
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Upcoming Tasks</p>
            <Link
              href="/tasks"
              className="text-[10px] font-medium text-[#415A77] hover:underline flex items-center gap-0.5"
            >
              <Plus size={10} /> New
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400">No upcoming tasks</p>
            </div>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-hidden">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg hover:bg-gray-50 px-1 py-1.5 transition-colors">
                  <CheckSquare size={13} className="text-gray-300 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
                  {t.contact && (
                    <Link href={`/contacts/${t.contact.id}`} className="text-[10px] text-[#415A77] hover:underline shrink-0 truncate max-w-[80px]">
                      {t.contact.firstName}
                    </Link>
                  )}
                  {t.dueDate && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <span className={cn('text-[9px] font-bold rounded px-1.5 py-0.5 shrink-0', PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500')}>
                    {t.priority[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    default:
      return <div className="p-4 text-xs text-gray-400">Unknown widget: {id}</div>
  }
}

// ─── Widget settings modal ────────────────────────────────────────────────────

function WidgetSettingsModal({
  layout,
  hidden,
  onToggle,
  onClose,
}: {
  layout: LayoutItem[]
  hidden: string[]
  onToggle: (id: string, visible: boolean) => void
  onClose: () => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const visibleIds = new Set(layout.map((i) => i.id))

  function toggleCollapse(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  function selectAll() {
    ALL_WIDGETS.forEach((w) => { if (!visibleIds.has(w.id)) onToggle(w.id, true) })
  }

  function clearAll() {
    ALL_WIDGETS.forEach((w) => { if (visibleIds.has(w.id)) onToggle(w.id, false) })
  }

  const totalVisible = visibleIds.size
  const totalAll = ALL_WIDGETS.length

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#0D1B2A] flex items-center justify-center">
              <SlidersHorizontal size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Widget Settings</p>
              <p className="text-xs text-gray-400">{totalVisible} of {totalAll} shown</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="ml-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Category list */}
        <div className="max-h-[60vh] overflow-y-auto">
          {WIDGET_CATEGORIES.map((cat) => {
            const isCollapsed = collapsed[cat.label]
            const catVisible = cat.widgetIds.filter((id) => visibleIds.has(id)).length
            const catTotal = cat.widgetIds.length
            const allCatChecked = catVisible === catTotal
            const someCatChecked = catVisible > 0 && catVisible < catTotal

            return (
              <div key={cat.label} className="border-b border-gray-50 last:border-0">
                {/* Category header */}
                <button
                  onClick={() => toggleCollapse(cat.label)}
                  className="flex items-center gap-3 w-full px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Category-level checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      if (allCatChecked) {
                        cat.widgetIds.forEach((id) => onToggle(id, false))
                      } else {
                        cat.widgetIds.forEach((id) => { if (!visibleIds.has(id)) onToggle(id, true) })
                      }
                    }}
                    className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                      allCatChecked
                        ? 'bg-[#415A77] border-[#415A77]'
                        : someCatChecked
                        ? 'bg-[#415A77]/30 border-[#415A77]/50'
                        : 'border-gray-300 bg-white hover:border-[#415A77]/50'
                    )}
                  >
                    {allCatChecked && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {someCatChecked && !allCatChecked && (
                      <div className="w-2 h-0.5 bg-[#415A77] rounded" />
                    )}
                  </div>

                  <span className="flex-1 text-xs font-semibold text-gray-700">{cat.label}</span>
                  <span className="text-[10px] text-gray-400 mr-1">{catVisible}/{catTotal}</span>
                  <ChevronDown
                    size={13}
                    className={cn('text-gray-300 transition-transform', isCollapsed && '-rotate-90')}
                  />
                </button>

                {/* Widgets in category */}
                {!isCollapsed && (
                  <div className="px-5 pb-2 space-y-0.5">
                    {cat.widgetIds.map((id) => {
                      const widget = ALL_WIDGETS.find((w) => w.id === id)
                      if (!widget) return null
                      const checked = visibleIds.has(id)
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <div
                            className={cn(
                              'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                              checked
                                ? 'bg-[#415A77] border-[#415A77]'
                                : 'border-gray-300 bg-white'
                            )}
                          >
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => onToggle(id, !checked)}
                          />
                          <span className="text-xs text-gray-700 flex-1">{widget.label}</span>
                          <span className="text-[10px] font-mono text-gray-300">{widget.defaultCols} col</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 bg-gray-50/60">
          <p className="text-xs text-gray-400">Changes apply instantly. Save layout to persist.</p>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#0D1B2A] px-4 py-2 text-xs font-medium text-white hover:bg-[#1B263B] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  item,
  customizing,
  stats,
  loading,
  onRemove,
  onResizeCols,
  onCompleteTask,
}: {
  item: LayoutItem
  customizing: boolean
  stats: DashboardStats | null
  loading: boolean
  onRemove: (id: string) => void
  onResizeCols: (id: string, cols: ColSize) => void
  onCompleteTask: (taskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const colIdx = COL_SIZES.indexOf(item.cols)

  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: `span ${item.cols}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      className="relative"
    >
      <div className={cn(
        'rounded-2xl border border-gray-100 bg-white shadow-sm h-full min-h-[160px] overflow-hidden transition-shadow',
        customizing && 'ring-2 ring-[#415A77]/20 ring-offset-1',
        isDragging && 'shadow-xl'
      )}>
        {/* Customize controls */}
        {customizing && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-2 pt-2 pointer-events-none">
            <button
              {...listeners}
              {...attributes}
              className="pointer-events-auto h-6 w-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing shadow-sm transition-colors"
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </button>
            <div className="pointer-events-auto flex items-center gap-1">
              {/* Resize */}
              <button
                onClick={() => onResizeCols(item.id, COL_SIZES[Math.max(0, colIdx - 1)])}
                disabled={colIdx === 0}
                className="h-6 w-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm disabled:opacity-30 transition-colors"
                title="Smaller"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[9px] font-mono text-gray-500 bg-white border border-gray-100 rounded px-1.5 py-0.5 shadow-sm">{item.cols}</span>
              <button
                onClick={() => onResizeCols(item.id, COL_SIZES[Math.min(COL_SIZES.length - 1, colIdx + 1)])}
                disabled={colIdx === COL_SIZES.length - 1}
                className="h-6 w-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm disabled:opacity-30 transition-colors"
                title="Larger"
              >
                <ChevronRight size={12} />
              </button>
              {/* Remove */}
              <button
                onClick={() => onRemove(item.id)}
                className="h-6 w-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-red-400 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors"
                title="Remove widget"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <WidgetContent id={item.id} stats={stats} loading={loading} onCompleteTask={onCompleteTask} />
      </div>
    </div>
  )
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function WidgetGrid({
  stats,
  loading,
}: {
  stats: DashboardStats | null
  loading: boolean
}) {
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT)
  const [hidden, setHidden] = useState<string[]>([])
  const [customizing, setCustomizing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLayout(loadLayout())
    setHidden(loadHidden())
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLayout((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id)
      const newIdx = prev.findIndex((i) => i.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function handleRemove(id: string) {
    setLayout((prev) => prev.filter((i) => i.id !== id))
    setHidden((prev) => [...prev, id])
  }

  function handleRestore(id: string) {
    const widget = ALL_WIDGETS.find((w) => w.id === id)
    if (!widget) return
    setLayout((prev) => [...prev, { id, cols: widget.defaultCols }])
    setHidden((prev) => prev.filter((h) => h !== id))
  }

  function handleToggleWidget(id: string, visible: boolean) {
    if (visible) {
      handleRestore(id)
    } else {
      handleRemove(id)
    }
  }

  function handleResizeCols(id: string, cols: ColSize) {
    setLayout((prev) => prev.map((i) => (i.id === id ? { ...i, cols } : i)))
  }

  function handleSave() {
    saveLayout(layout, hidden)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleCompleteTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    // Optimistically remove from the list — parent can refetch
    window.dispatchEvent(new CustomEvent('task-completed', { detail: taskId }))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          {customizing && (
            <>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-[#415A77]/40 hover:text-[#415A77] transition-all"
              >
                <SlidersHorizontal size={13} />
                Settings
                {hidden.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-[#415A77] text-white text-[9px] font-bold px-1.5 py-0.5 leading-none">
                    {hidden.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleSave}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all',
                  saved
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-[#0D1B2A] text-white hover:bg-[#1B263B]'
                )}
              >
                {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                {saved ? 'Saved!' : 'Save Layout'}
              </button>
            </>
          )}
          <button
            onClick={() => { setCustomizing((v) => !v); setSettingsOpen(false) }}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all border',
              customizing
                ? 'bg-[#415A77]/10 border-[#415A77]/30 text-[#415A77]'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            <Settings2 size={13} />
            {customizing ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-4 auto-rows-auto">
            {layout.map((item) => (
              <SortableWidget
                key={item.id}
                item={item}
                customizing={customizing}
                stats={stats}
                loading={loading}
                onRemove={handleRemove}
                onResizeCols={handleResizeCols}
                onCompleteTask={handleCompleteTask}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {settingsOpen && (
        <WidgetSettingsModal
          layout={layout}
          hidden={hidden}
          onToggle={handleToggleWidget}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
