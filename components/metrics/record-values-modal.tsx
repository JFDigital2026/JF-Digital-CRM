'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Check, Terminal } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatMetricValue } from '@/lib/metrics/format'
import type { MetricUnit } from '@/lib/metrics/types'
import { AGGREGATION_LABELS } from '@/lib/metrics/custom'

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

export interface CustomMetricSummary {
  id: string
  key: string
  label: string
  unit: string
  aggregation: 'SUM' | 'AVERAGE' | 'LATEST' | 'MAX' | 'MIN'
  metricId: string
}

interface StoredValue {
  id: string
  date: string
  value: number
  note: string | null
  source: 'MANUAL' | 'API'
}

interface Props {
  metric: CustomMetricSummary | null
  open: boolean
  onClose: () => void
  onChanged: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RecordValuesModal({ metric, open, onClose, onChanged }: Props) {
  const [values, setValues] = useState<StoredValue[]>([])
  const [date, setDate] = useState(today())
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showApi, setShowApi] = useState(false)

  const load = useCallback(async () => {
    if (!metric) return
    setLoading(true)
    try {
      const res = await fetch(`/api/metrics/custom/${metric.id}/values`)
      if (res.ok) setValues(await res.json())
    } finally {
      setLoading(false)
    }
  }, [metric])

  useEffect(() => {
    if (open && metric) {
      load()
      setDate(today()); setValue(''); setNote(''); setError(''); setShowApi(false)
    }
  }, [open, metric, load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metric || value.trim() === '') return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/metrics/custom/${metric.id}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, value: Number(value), note: note.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save')
      setValue(''); setNote('')
      setSaved(true); setTimeout(() => setSaved(false), 1600)
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (valueId: string) => {
    if (!metric) return
    await fetch(`/api/metrics/custom/${metric.id}/values?valueId=${valueId}`, {
      method: 'DELETE',
    })
    await load()
    onChanged()
  }

  if (!metric) return null

  const existingForDate = values.find((v) => v.date.slice(0, 10) === date)
  const curlExample = `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/custom-metrics/${metric.key}/values" \\
  -H "Authorization: Bearer <key with metrics:write>" \\
  -H "Content-Type: application/json" \\
  -d '{"values":[{"date":"${today()}","value":34}]}'`

  return (
    <Modal open={open} onClose={onClose} title={metric.label} size="lg">
      <p className="text-sm mb-4" style={{ color: '#778DA9' }}>
        {AGGREGATION_LABELS[metric.aggregation]}. One value per day — recording a
        date twice corrects it rather than adding a second entry.
      </p>

      <form onSubmit={submit} className="flex gap-2 items-end mb-2">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#778DA9' }}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#778DA9' }}>Value</label>
          <input
            type="number" step="any" value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0" className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#778DA9' }}>
            Note <span className="font-normal">(optional)</span>
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="" className={inputClass} maxLength={200} />
        </div>
        <button
          type="submit"
          disabled={saving || value.trim() === ''}
          className="rounded-md px-4 py-2 text-sm font-medium text-white shrink-0 transition-opacity disabled:opacity-40"
          style={{ background: saved ? '#27AE60' : '#415A77' }}
        >
          {saved ? <Check size={15} /> : saving ? 'Saving' : 'Record'}
        </button>
      </form>

      {existingForDate && (
        <p className="text-xs mb-3" style={{ color: '#A8B2C1' }}>
          {date} already holds {formatMetricValue(existingForDate.value, metric.unit as MetricUnit)}. Saving replaces it.
        </p>
      )}

      {error && <p className="text-sm mb-3" style={{ color: '#C0392B' }}>{error}</p>}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#A8B2C1', letterSpacing: '0.05em' }}>
            History
          </h3>
          <button
            type="button"
            onClick={() => setShowApi((s) => !s)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[rgba(65,90,119,0.08)]"
            style={{ color: '#415A77' }}
          >
            <Terminal size={12} />
            {showApi ? 'Hide' : 'Push from n8n'}
          </button>
        </div>

        {showApi && (
          <pre
            className="text-xs rounded-lg p-3 mb-3 overflow-x-auto"
            style={{ background: 'rgba(13,27,42,0.04)', color: '#415A77' }}
          >
            {curlExample}
          </pre>
        )}

        {loading ? (
          <div className="h-20 rounded-lg animate-pulse" style={{ background: 'rgba(13,27,42,0.04)' }} />
        ) : values.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: '#A8B2C1' }}>
            Nothing recorded yet. Until there is, this metric shows an em dash on any view.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {values.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(13,27,42,0.06)' }}
              >
                <span style={{ color: '#778DA9', minWidth: 92 }}>{v.date.slice(0, 10)}</span>
                <span className="font-medium" style={{ color: '#1B263B', minWidth: 70 }}>
                  {formatMetricValue(v.value, metric.unit as MetricUnit)}
                </span>
                {v.source === 'API' && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(65,90,119,0.10)', color: '#415A77' }}
                  >
                    API
                  </span>
                )}
                <span className="flex-1 truncate text-xs" style={{ color: '#A8B2C1' }}>{v.note}</span>
                <button
                  onClick={() => remove(v.id)}
                  className="p-1 rounded shrink-0 transition-colors hover:bg-[rgba(192,57,43,0.08)]"
                  aria-label={`Delete entry for ${v.date.slice(0, 10)}`}
                >
                  <Trash2 size={13} style={{ color: '#C0392B' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
