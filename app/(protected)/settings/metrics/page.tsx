'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, BarChart3, ChevronRight, Target, ArrowLeft, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { MetricCatalogEntry } from '@/lib/metrics/types'

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

interface MetricView {
  id: string
  name: string
  slug: string
  description: string | null
  order: number
  items: { id: string; metricId: string; order: number; showTrend: boolean }[]
}

interface MetricTarget {
  id: string
  metricId: string
  value: number
  period: string
}

/** Metrics that gate a "vs target" card and therefore need a number entered. */
const TARGETABLE = ['revenue.mrrVsTarget', 'pricing.foundingSlotsRemaining']

const TARGET_HELP: Record<string, string> = {
  'revenue.mrrVsTarget': 'Your MRR goal in dollars. Powers MRR vs Target and MRR Gap to Target.',
  'pricing.foundingSlotsRemaining': 'Total founding client slots. Defaults to 10 if left blank.',
}

export default function MetricsSettingsPage() {
  const router = useRouter()
  const [views, setViews] = useState<MetricView[]>([])
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([])
  const [targets, setTargets] = useState<MetricTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({})
  const [savingTarget, setSavingTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [viewsRes, registryRes, targetsRes] = await Promise.all([
        fetch('/api/metrics/views'),
        fetch('/api/metrics/registry'),
        fetch('/api/metrics/targets'),
      ])
      if (viewsRes.ok) setViews(await viewsRes.json())
      if (registryRes.ok) setCatalog((await registryRes.json()).metrics ?? [])
      if (targetsRes.ok) {
        const t: MetricTarget[] = await targetsRes.json()
        setTargets(t)
        setTargetDrafts(
          Object.fromEntries(t.map((row) => [row.metricId, String(row.value)]))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/metrics/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not create view')
      const view: MetricView = await res.json()
      setNewName('')
      router.push(`/settings/metrics/${view.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create view')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/metrics/views/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  const saveTarget = async (metricId: string) => {
    const raw = targetDrafts[metricId]?.trim()
    setSavingTarget(metricId)
    try {
      await fetch('/api/metrics/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricId,
          value: raw === '' || raw === undefined ? null : Number(raw),
        }),
      })
      const res = await fetch('/api/metrics/targets')
      if (res.ok) setTargets(await res.json())
    } finally {
      setSavingTarget(null)
    }
  }

  const labelFor = (metricId: string) =>
    catalog.find((m) => m.id === metricId)?.label ?? metricId

  const availableCount = catalog.filter((m) => m.available).length

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm mb-4 transition-colors hover:text-[#415A77]"
        style={{ color: '#778DA9' }}
      >
        <ArrowLeft size={15} />
        Settings
      </Link>

      <PageHeader
        title="Metrics"
        subtitle={`Compose custom metric views from ${availableCount} available KPIs. Each view appears as its own tab on the Metrics page.`}
      />

      {/* ─── Create ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New view name — e.g. Outbound Command"
          className={inputClass}
          maxLength={60}
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white shrink-0 transition-opacity disabled:opacity-40"
          style={{ background: '#415A77' }}
        >
          <Plus size={15} />
          Create
        </button>
      </form>

      {error && (
        <p className="mb-4 text-sm" style={{ color: '#C0392B' }}>
          {error}
        </p>
      )}

      {/* ─── Views ──────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold mb-3" style={{ color: '#1B263B' }}>
        Your views
      </h2>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] rounded-xl animate-pulse" style={{ background: 'rgba(13,27,42,0.04)' }} />
          ))}
        </div>
      ) : views.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(13,27,42,0.07)' }}
        >
          <Sparkles size={22} style={{ color: '#778DA9' }} className="mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: '#1B263B' }}>
            No custom views yet
          </p>
          <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: '#778DA9' }}>
            A view is a named set of KPIs — the screen you actually check each morning.
            Name one above, then pick the metrics that answer the question you keep asking.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {views.map((view) => (
            <div
              key={view.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3 transition-shadow hover:shadow-sm"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(13,27,42,0.07)' }}
            >
              <div className="p-2 rounded-lg shrink-0" style={{ background: 'rgba(65,90,119,0.10)' }}>
                <BarChart3 size={16} style={{ color: '#415A77' }} />
              </div>
              <Link href={`/settings/metrics/${view.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1B263B' }}>
                  {view.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#778DA9' }}>
                  {view.items.length} {view.items.length === 1 ? 'metric' : 'metrics'}
                  {view.description ? ` · ${view.description}` : ''}
                </p>
              </Link>
              <Link
                href={`/metrics?view=${view.slug}`}
                className="text-xs px-2.5 py-1 rounded-md shrink-0 transition-colors hover:bg-[rgba(13,27,42,0.06)]"
                style={{ color: '#415A77' }}
              >
                Open
              </Link>
              <button
                onClick={() => setDeleteId(view.id)}
                className="p-1.5 rounded-md shrink-0 transition-colors hover:bg-[rgba(192,57,43,0.08)]"
                aria-label={`Delete ${view.name}`}
              >
                <Trash2 size={15} style={{ color: '#C0392B' }} />
              </button>
              <Link href={`/settings/metrics/${view.id}`} className="shrink-0">
                <ChevronRight size={16} style={{ color: '#A8B2C1' }} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ─── Targets ────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold mt-10 mb-1" style={{ color: '#1B263B' }}>
        Targets
      </h2>
      <p className="text-sm mb-3" style={{ color: '#778DA9' }}>
        Some KPIs compare against a goal you set rather than a number the CRM can
        derive. Until a target is entered, those cards stay blank instead of showing zero.
      </p>

      <div className="space-y-2">
        {TARGETABLE.map((metricId) => {
          const current = targets.find((t) => t.metricId === metricId)
          const draft = targetDrafts[metricId] ?? ''
          const dirty = draft !== (current ? String(current.value) : '')
          return (
            <div
              key={metricId}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(13,27,42,0.07)' }}
            >
              <div className="p-2 rounded-lg shrink-0" style={{ background: 'rgba(65,90,119,0.10)' }}>
                <Target size={16} style={{ color: '#415A77' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#1B263B' }}>
                  {labelFor(metricId)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#778DA9' }}>
                  {TARGET_HELP[metricId]}
                </p>
              </div>
              <input
                type="number"
                value={draft}
                onChange={(e) =>
                  setTargetDrafts((prev) => ({ ...prev, [metricId]: e.target.value }))
                }
                placeholder="—"
                className="w-28 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-right outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20"
              />
              <button
                onClick={() => saveTarget(metricId)}
                disabled={!dirty || savingTarget === metricId}
                className="text-xs px-3 py-1.5 rounded-md font-medium text-white shrink-0 transition-opacity disabled:opacity-30"
                style={{ background: '#415A77' }}
              >
                {savingTarget === metricId ? 'Saving' : 'Save'}
              </button>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this view?"
        description="The view and its tab are removed. The underlying metrics are untouched."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
