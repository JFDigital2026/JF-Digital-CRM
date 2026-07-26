'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Search, Plus, X, ArrowUp, ArrowDown,
  TrendingUp, Lock, Check, ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import type { MetricCatalogEntry } from '@/lib/metrics/types'

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

interface ViewItem {
  metricId: string
  showTrend: boolean
}

interface MetricView {
  id: string
  name: string
  slug: string
  description: string | null
  items: { metricId: string; order: number; showTrend: boolean }[]
}

export default function MetricViewEditorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const viewId = params.id

  const [view, setView] = useState<MetricView | null>(null)
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([])
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ViewItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [viewRes, registryRes] = await Promise.all([
        fetch(`/api/metrics/views/${viewId}`),
        fetch('/api/metrics/registry'),
      ])
      if (viewRes.ok) {
        const v: MetricView = await viewRes.json()
        setView(v)
        setName(v.name)
        setDescription(v.description ?? '')
        setItems(
          [...v.items]
            .sort((a, b) => a.order - b.order)
            .map((i) => ({ metricId: i.metricId, showTrend: i.showTrend }))
        )
      }
      if (registryRes.ok) {
        const data = await registryRes.json()
        setCatalog(data.metrics ?? [])
        setCategories(data.categories ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [viewId])

  useEffect(() => {
    load()
  }, [load])

  const byId = useMemo(
    () => new Map(catalog.map((m) => [m.id, m])),
    [catalog]
  )
  const selectedIds = useMemo(() => new Set(items.map((i) => i.metricId)), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((m) => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false
      if (!q) return true
      return (
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.categoryLabel.toLowerCase().includes(q)
      )
    })
  }, [catalog, search, activeCategory])

  const grouped = useMemo(() => {
    const map = new Map<string, MetricCatalogEntry[]>()
    for (const m of filtered) {
      const list = map.get(m.categoryLabel) ?? []
      list.push(m)
      map.set(m.categoryLabel, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const add = (metricId: string) => {
    if (selectedIds.has(metricId)) return
    setItems((prev) => [...prev, { metricId, showTrend: false }])
    setSaved(false)
  }

  const remove = (metricId: string) => {
    setItems((prev) => prev.filter((i) => i.metricId !== metricId))
    setSaved(false)
  }

  const move = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setSaved(false)
  }

  const toggleTrend = (metricId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.metricId === metricId ? { ...i, showTrend: !i.showTrend } : i))
    )
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/metrics/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Untitled view',
          description: description.trim() || null,
          items,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setView(updated)
        setSaved(true)
        setTimeout(() => setSaved(false), 2200)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl">
        <div className="h-8 w-48 rounded animate-pulse mb-6" style={{ background: 'rgba(13,27,42,0.06)' }} />
        <div className="h-64 rounded-xl animate-pulse" style={{ background: 'rgba(13,27,42,0.04)' }} />
      </div>
    )
  }

  if (!view) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#778DA9' }}>
          This view no longer exists.
        </p>
        <Link href="/settings/metrics" className="text-sm" style={{ color: '#415A77' }}>
          Back to Metrics settings
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/settings/metrics"
        className="inline-flex items-center gap-1.5 text-sm mb-4 transition-colors hover:text-[#415A77]"
        style={{ color: '#778DA9' }}
      >
        <ArrowLeft size={15} />
        Metrics settings
      </Link>

      <PageHeader
        title={view.name}
        subtitle={`${items.length} ${items.length === 1 ? 'metric' : 'metrics'} · renders as a tab on the Metrics page`}
        actions={
          <>
            <Link
              href={`/metrics?view=${view.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[rgba(13,27,42,0.05)]"
              style={{ color: '#415A77' }}
            >
              <ExternalLink size={14} />
              Preview
            </Link>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              style={{ background: saved ? '#27AE60' : '#415A77' }}
            >
              {saved ? <Check size={15} /> : null}
              {saving ? 'Saving' : saved ? 'Saved' : 'Save view'}
            </button>
          </>
        }
      />

      {/* ─── Name / description ─────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#778DA9' }}>
            View name
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            className={inputClass}
            maxLength={60}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#778DA9' }}>
            Description <span className="font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSaved(false)
            }}
            placeholder="What question does this view answer?"
            className={inputClass}
            maxLength={280}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Selected ─────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#1B263B' }}>
            In this view
          </h2>
          <p className="text-xs mb-3" style={{ color: '#778DA9' }}>
            Cards render in this order. Toggle the trend icon to add a chart below the grid.
          </p>

          {items.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: 'rgba(13,27,42,0.02)', border: '1px dashed rgba(13,27,42,0.12)' }}
            >
              <p className="text-sm" style={{ color: '#778DA9' }}>
                Nothing selected yet. Pick KPIs from the catalog on the right.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item, index) => {
                const meta = byId.get(item.metricId)
                return (
                  <div
                    key={item.metricId}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                    style={{
                      background: 'rgba(255,255,255,0.75)',
                      border: '1px solid rgba(13,27,42,0.07)',
                    }}
                  >
                    <span
                      className="text-xs font-semibold w-5 text-center shrink-0"
                      style={{ color: '#A8B2C1' }}
                    >
                      {index + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1B263B' }}>
                        {meta?.label ?? item.metricId}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#778DA9' }}>
                        {meta
                          ? meta.available
                            ? meta.categoryLabel
                            : meta.unavailableLabel
                          : 'Unknown metric — no longer in the registry'}
                      </p>
                    </div>

                    {meta?.supportsTrend && (
                      <button
                        onClick={() => toggleTrend(item.metricId)}
                        className="p-1.5 rounded-md shrink-0 transition-colors"
                        style={{
                          background: item.showTrend ? 'rgba(65,90,119,0.14)' : 'transparent',
                          color: item.showTrend ? '#415A77' : '#A8B2C1',
                        }}
                        title={item.showTrend ? 'Chart shown' : 'Show a trend chart'}
                      >
                        <TrendingUp size={14} />
                      </button>
                    )}

                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="p-1 rounded shrink-0 disabled:opacity-20"
                      aria-label="Move up"
                    >
                      <ArrowUp size={13} style={{ color: '#778DA9' }} />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      className="p-1 rounded shrink-0 disabled:opacity-20"
                      aria-label="Move down"
                    >
                      <ArrowDown size={13} style={{ color: '#778DA9' }} />
                    </button>
                    <button
                      onClick={() => remove(item.metricId)}
                      className="p-1 rounded shrink-0"
                      aria-label="Remove"
                    >
                      <X size={14} style={{ color: '#C0392B' }} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── Catalog ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#1B263B' }}>
            KPI catalog
          </h2>
          <p className="text-xs mb-3" style={{ color: '#778DA9' }}>
            Greyed metrics are defined but have no data source yet. They can be added —
            they will render with the reason instead of a misleading zero.
          </p>

          <div className="relative mb-2">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#A8B2C1' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search KPIs"
              className={cn(inputClass, 'pl-9')}
            />
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            <button
              onClick={() => setActiveCategory('all')}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: activeCategory === 'all' ? '#415A77' : 'rgba(13,27,42,0.05)',
                color: activeCategory === 'all' ? '#fff' : '#778DA9',
              }}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className="text-xs px-2.5 py-1 rounded-md transition-colors"
                style={{
                  background: activeCategory === c.key ? '#415A77' : 'rgba(13,27,42,0.05)',
                  color: activeCategory === c.key ? '#fff' : '#778DA9',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="max-h-[560px] overflow-y-auto pr-1 space-y-4">
            {grouped.length === 0 && (
              <p className="text-sm py-6 text-center" style={{ color: '#A8B2C1' }}>
                No KPIs match that search.
              </p>
            )}
            {grouped.map(([categoryLabel, metrics]) => (
              <div key={categoryLabel}>
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: '#A8B2C1', letterSpacing: '0.05em' }}
                >
                  {categoryLabel}
                </p>
                <div className="space-y-1">
                  {metrics.map((m) => {
                    const isSelected = selectedIds.has(m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => (isSelected ? remove(m.id) : add(m.id))}
                        className="w-full flex items-start gap-2 text-left rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(65,90,119,0.06)]"
                        style={{ opacity: m.available ? 1 : 0.55 }}
                      >
                        <span className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <Check size={14} style={{ color: '#27AE60' }} />
                          ) : m.available ? (
                            <Plus size={14} style={{ color: '#778DA9' }} />
                          ) : (
                            <Lock size={13} style={{ color: '#A8B2C1' }} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium" style={{ color: '#1B263B' }}>
                            {m.label}
                          </span>
                          <span className="block text-xs leading-snug" style={{ color: '#778DA9' }}>
                            {m.available ? m.description : m.unavailableLabel}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
