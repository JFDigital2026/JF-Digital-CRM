'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { StepLog } from '@/lib/automation-types'
import { cn } from '@/lib/utils'

type LogEntry = {
  id: string
  contactId: string | null
  status: 'SUCCESS' | 'FAILURE' | 'SKIPPED'
  stepsCompleted: number
  duration: number | null
  error: string | null
  stepLogs: StepLog[] | null
  executedAt: string
  contact: { id: string; firstName: string; lastName: string } | null
}

const STATUS: Record<string, { label: string; classes: string }> = {
  SUCCESS: { label: 'Success', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILURE: { label: 'Failed',  classes: 'bg-red-50 text-red-600 border-red-200' },
  SKIPPED: { label: 'Skipped', classes: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const LOG_STYLES: Record<StepLog['status'], { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-50 border-emerald-100 text-emerald-800', icon: '✓' },
  skipped: { bg: 'bg-amber-50 border-amber-100 text-amber-800',       icon: '⏭' },
  error:   { bg: 'bg-red-50 border-red-100 text-red-700',             icon: '✕' },
}

export default function AutomationLogsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const pageSize = 25

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/automations/${id}/logs?page=${p}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fmt = (ms: number | null) => {
    if (ms == null) return '—'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={() => router.push(`/automations/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-4 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Automation
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Execution Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total executions</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
          {['Contact', 'Status', 'Steps', 'Duration', 'Error', 'Executed'].map((h, i) => (
            <p
              key={h}
              className={cn('text-[10px] font-semibold uppercase tracking-widest text-gray-400', i === 0 ? 'col-span-3' : i === 4 ? 'col-span-2' : i === 5 ? 'col-span-2' : 'col-span-1')}
            >{h}</p>
          ))}
          <div className="col-span-2" />
        </div>

        {loading && (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-50 animate-pulse rounded-lg" />)}
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-gray-600 mb-1">No executions yet</p>
            <p className="text-xs text-gray-400">Logs appear here when this automation runs</p>
          </div>
        )}

        {!loading && logs.map((log) => {
          const sv = STATUS[log.status] ?? STATUS.FAILURE
          const isOpen = expanded === log.id
          const stepLogs = Array.isArray(log.stepLogs) ? log.stepLogs : []
          return (
            <div key={log.id} className="border-b border-gray-50 last:border-0">
              <div
                className="grid grid-cols-12 gap-4 px-5 py-3.5 hover:bg-gray-50/50 cursor-pointer transition-colors items-center"
                onClick={() => setExpanded(isOpen ? null : log.id)}
              >
                {/* Contact */}
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  {log.contact ? (
                    <>
                      <div className="h-7 w-7 shrink-0 rounded-full bg-[#415A77]/10 flex items-center justify-center text-[10px] font-semibold text-[#415A77]">
                        {log.contact.firstName[0]}{log.contact.lastName[0]}
                      </div>
                      <span className="text-sm text-gray-800 truncate">{log.contact.firstName} {log.contact.lastName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Unknown</span>
                  )}
                </div>
                {/* Status */}
                <div className="col-span-1">
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', sv.classes)}>{sv.label}</span>
                </div>
                {/* Steps */}
                <div className="col-span-1">
                  <span className="text-sm text-gray-700">{log.stepsCompleted}</span>
                </div>
                {/* Duration */}
                <div className="col-span-1">
                  <span className="text-sm text-gray-700 font-mono">{fmt(log.duration)}</span>
                </div>
                {/* Error */}
                <div className="col-span-2 min-w-0">
                  {log.error ? (
                    <span className="text-xs text-red-500 truncate block" title={log.error}>{log.error}</span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </div>
                {/* Executed */}
                <div className="col-span-2">
                  <span className="text-xs text-gray-400">{new Date(log.executedAt).toLocaleString()}</span>
                </div>
                {/* Expand */}
                <div className="col-span-2 flex justify-end">
                  {stepLogs.length > 0 && (
                    <svg className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Expanded step logs */}
              {isOpen && stepLogs.length > 0 && (
                <div className="px-12 pb-4 space-y-1.5">
                  {stepLogs.map((sl, i) => {
                    const st = LOG_STYLES[sl.status] ?? LOG_STYLES.error
                    return (
                      <div key={i} className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2 text-xs', st.bg)}>
                        <span className="font-bold mt-0.5 shrink-0">{st.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{sl.stepLabel}</span>
                          {sl.detail && <span className="ml-1.5 opacity-75">{sl.detail}</span>}
                        </div>
                        <span className="shrink-0 font-mono opacity-60">{sl.durationMs}ms</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-gray-400">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
