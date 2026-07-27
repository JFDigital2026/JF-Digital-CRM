'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Copy, Check } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatMetricValue } from '@/lib/metrics/format'
import type { MetricUnit } from '@/lib/metrics/types'
import { AGGREGATION_LABELS } from '@/lib/metrics/custom'

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

/**
 * Values for a custom metric.
 *
 * There is deliberately no entry form — values arrive from an automation, so
 * this shows how to wire that up and what has landed so far. Individual entries
 * can still be deleted, which is the one manual action that stays useful when a
 * workflow pushes something wrong.
 */
export function MetricValuesModal({ metric, open, onClose, onChanged }: Props) {
  const [values, setValues] = useState<StoredValue[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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
    if (open && metric) { load(); setCopied(false) }
  }, [open, metric, load])

  const remove = async (valueId: string) => {
    if (!metric) return
    await fetch(`/api/metrics/custom/${metric.id}/values?valueId=${valueId}`, {
      method: 'DELETE',
    })
    await load()
    onChanged()
  }

  if (!metric) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const endpoint = `${origin}/api/v1/custom-metrics/${metric.key}/values`
  const snippet = `POST ${endpoint}
Authorization: Bearer <API key with metrics:write>
Content-Type: application/json

{"values":[{"date":"YYYY-MM-DD","value":34}]}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the endpoint is on screen to copy by hand */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={metric.label} size="lg">
      <p className="text-sm mb-4" style={{ color: '#778DA9' }}>
        {AGGREGATION_LABELS[metric.aggregation]}. Values are pushed in by an
        automation — one per day, and re-sending a date corrects it rather than
        adding a second entry.
      </p>

      {/* ─── How to feed it ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: '#A8B2C1', letterSpacing: '0.05em' }}
        >
          Endpoint
        </h3>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[rgba(65,90,119,0.08)]"
          style={{ color: copied ? '#27AE60' : '#415A77' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy URL'}
        </button>
      </div>

      <pre
        className="text-xs rounded-lg p-3 mb-5 overflow-x-auto leading-relaxed"
        style={{ background: 'rgba(13,27,42,0.04)', color: '#415A77' }}
      >
        {snippet}
      </pre>

      {/* ─── What has landed ─────────────────────────────────────────────── */}
      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: '#A8B2C1', letterSpacing: '0.05em' }}
      >
        Recorded values
      </h3>

      {loading ? (
        <div className="h-20 rounded-lg animate-pulse" style={{ background: 'rgba(13,27,42,0.04)' }} />
      ) : values.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: '#A8B2C1' }}>
          Nothing pushed yet. The metric shows an em dash on a view until the
          first value arrives.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1">
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
    </Modal>
  )
}
