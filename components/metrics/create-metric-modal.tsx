'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Info } from 'lucide-react'
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

/** The subset of a CustomMetric the form needs to edit one. */
export interface EditableMetric {
  id: string
  label: string
  description: string
  unit: string
  category: string
  aggregation: Aggregation
  higherIsBetter: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  /** Receives the metric id (`custom.<key>`) so callers can auto-add it to a view. */
  onSaved: (metricId: string) => void
  /** Omit to create; pass a metric to edit it in place. */
  metric?: EditableMetric | null
}

export function CreateMetricModal({ open, onClose, onSaved, metric }: Props) {
  const editing = !!metric

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState<MetricUnit>('number')
  const [category, setCategory] = useState('custom')
  const [aggregation, setAggregation] = useState<Aggregation>('SUM')
  const [higherIsBetter, setHigherIsBetter] = useState(true)
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load the metric being edited, or reset to defaults for a fresh create.
  useEffect(() => {
    if (!open) return
    if (metric) {
      setLabel(metric.label)
      setDescription(metric.description ?? '')
      setUnit(metric.unit as MetricUnit)
      setCategory(metric.category)
      setAggregation(metric.aggregation)
      setHigherIsBetter(metric.higherIsBetter)
    } else {
      setLabel(''); setDescription(''); setUnit('number')
      setCategory('custom'); setAggregation('SUM'); setHigherIsBetter(true)
    }
    setTarget(''); setError('')
  }, [open, metric])

  // Show what the number will actually look like on a card, so the unit choice
  // is concrete rather than an abstract dropdown.
  const preview = useMemo(() => formatMetricValue(1234.5, unit), [unit])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) { setError('Give the metric a name.'); return }

    setSaving(true); setError('')
    try {
      const payload = {
        label: label.trim(),
        description: description.trim() || undefined,
        unit,
        category,
        aggregation,
        higherIsBetter,
        ...(editing ? {} : { target: target.trim() === '' ? null : Number(target) }),
      }

      const res = await fetch(
        editing ? `/api/metrics/custom/${metric!.id}` : '/api/metrics/custom',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        throw new Error((await res.json()).error ?? 'Could not save the metric')
      }
      const saved = await res.json()
      onSaved(saved.metricId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the metric')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${metric!.label}` : 'Create a metric'}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-5">
        {!editing && (
          <p className="text-sm leading-relaxed" style={{ color: '#778DA9' }}>
            For things the CRM has no data for — LinkedIn requests sent, content
            published, ad spend. An automation feeds it the numbers, and it then
            behaves like any other KPI.
          </p>
        )}

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

          {!editing && (
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
          )}
        </div>

        {error && <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
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
            {saving ? 'Saving' : editing ? 'Save changes' : 'Create metric'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
