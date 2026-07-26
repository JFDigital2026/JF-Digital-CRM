'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatMetricValue } from '@/lib/metrics/format'
import { CATEGORY_LABELS, CATEGORY_ORDER, type MetricUnit } from '@/lib/metrics/types'
import {
  AGGREGATION_HELP,
  AGGREGATION_LABELS,
  UNIT_OPTIONS,
  VALID_AGGREGATIONS,
} from '@/lib/metrics/custom'

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

const labelClass = 'block text-xs font-medium mb-1.5'

type Aggregation = (typeof VALID_AGGREGATIONS)[number]

interface BackfillRow {
  date: string
  value: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CreateMetricModal({ open, onClose, onCreated }: Props) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState<MetricUnit>('number')
  const [category, setCategory] = useState('custom')
  const [aggregation, setAggregation] = useState<Aggregation>('SUM')
  const [higherIsBetter, setHigherIsBetter] = useState(true)
  const [target, setTarget] = useState('')
  const [backfill, setBackfill] = useState<BackfillRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setLabel(''); setDescription(''); setUnit('number'); setCategory('custom')
    setAggregation('SUM'); setHigherIsBetter(true); setTarget('')
    setBackfill([]); setError('')
  }

  const close = () => { reset(); onClose() }

  // Show the user what their number will actually look like on a card, so the
  // unit choice is concrete rather than an abstract dropdown.
  const preview = useMemo(() => formatMetricValue(1234.5, unit), [unit])

  const addRow = () =>
    setBackfill((prev) => [...prev, { date: today(), value: '' }])

  const updateRow = (i: number, patch: Partial<BackfillRow>) =>
    setBackfill((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const removeRow = (i: number) =>
    setBackfill((prev) => prev.filter((_, idx) => idx !== i))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) { setError('Give the metric a name.'); return }

    // Two entries on one date would collide on the unique constraint and the
    // request would fail with a database error; catch it here instead.
    const dates = backfill.filter((r) => r.value.trim() !== '').map((r) => r.date)
    if (new Set(dates).size !== dates.length) {
      setError('Two starting values share a date. One value per day.')
      return
    }

    setSaving(true); setError('')
    try {
      const res = await fetch('/api/metrics/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || undefined,
          unit,
          category,
          aggregation,
          higherIsBetter,
          target: target.trim() === '' ? null : Number(target),
          values: backfill
            .filter((r) => r.value.trim() !== '')
            .map((r) => ({ date: r.date, value: Number(r.value) })),
        }),
      })
      if (!res.ok) {
        throw new Error((await res.json()).error ?? 'Could not create the metric')
      }
      reset()
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the metric')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Create a metric" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-relaxed" style={{ color: '#778DA9' }}>
          For things the CRM has no data for — LinkedIn requests sent, content
          published, ad spend. You record the numbers yourself, or push them in
          from n8n. It then behaves like any other KPI.
        </p>

        <div>
          <label className={labelClass} style={{ color: '#778DA9' }}>Name</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="LinkedIn Requests Sent"
            className={inputClass}
            maxLength={60}
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass} style={{ color: '#778DA9' }}>
            Description <span className="font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Connection requests sent to PI attorneys"
            className={inputClass}
            maxLength={280}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} style={{ color: '#778DA9' }}>How it is tracked</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as MetricUnit)}
              className={inputClass}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label} — {u.example}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: '#A8B2C1' }}>
              1234.5 renders as <span style={{ color: '#415A77', fontWeight: 500 }}>{preview}</span>
            </p>
          </div>

          <div>
            <label className={labelClass} style={{ color: '#778DA9' }}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: '#A8B2C1' }}>
              Where it files in the KPI picker.
            </p>
          </div>
        </div>

        <div>
          <label className={labelClass} style={{ color: '#778DA9' }}>
            Combining multiple entries
          </label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as Aggregation)}
            className={inputClass}
          >
            {VALID_AGGREGATIONS.map((a) => (
              <option key={a} value={a}>{AGGREGATION_LABELS[a]}</option>
            ))}
          </select>
          <p className="text-xs mt-1.5 flex gap-1.5" style={{ color: '#A8B2C1' }}>
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>{AGGREGATION_HELP[aggregation]}</span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} style={{ color: '#778DA9' }}>Direction</label>
            <select
              value={higherIsBetter ? 'up' : 'down'}
              onChange={(e) => setHigherIsBetter(e.target.value === 'up')}
              className={inputClass}
            >
              <option value="up">Higher is better</option>
              <option value="down">Lower is better</option>
            </select>
            <p className="text-xs mt-1" style={{ color: '#A8B2C1' }}>
              Decides whether a rise shows green or red.
            </p>
          </div>

          <div>
            <label className={labelClass} style={{ color: '#778DA9' }}>
              Target <span className="font-normal">(optional)</span>
            </label>
            <input
              type="number"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="—"
              className={inputClass}
            />
            <p className="text-xs mt-1" style={{ color: '#A8B2C1' }}>
              Editable later in Targets.
            </p>
          </div>
        </div>

        {/* ─── Starting values ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelClass + ' mb-0'} style={{ color: '#778DA9' }}>
              Starting values <span className="font-normal">(optional)</span>
            </label>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[rgba(65,90,119,0.08)]"
              style={{ color: '#415A77' }}
            >
              <Plus size={13} />
              Add a day
            </button>
          </div>

          {backfill.length === 0 ? (
            <p className="text-xs" style={{ color: '#A8B2C1' }}>
              Add a few past days and the metric has a trend line straight away
              instead of a single point. You can always record more later.
            </p>
          ) : (
            <div className="space-y-1.5">
              {backfill.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                    className={inputClass + ' flex-1'}
                  />
                  <input
                    type="number"
                    step="any"
                    value={row.value}
                    onChange={(e) => updateRow(i, { value: e.target.value })}
                    placeholder="Value"
                    className={inputClass + ' w-32'}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="p-2 rounded-md shrink-0 transition-colors hover:bg-[rgba(192,57,43,0.08)]"
                    aria-label="Remove row"
                  >
                    <Trash2 size={14} style={{ color: '#C0392B' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !label.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: '#415A77' }}
          >
            {saving ? 'Creating' : 'Create metric'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
