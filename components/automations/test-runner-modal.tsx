'use client'

import { useState, useEffect } from 'react'
import type { AutomationDefinition, StepLog } from '@/lib/automation-types'
import { cn } from '@/lib/utils'

interface Contact {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
}

interface TestRunnerModalProps {
  automationId: string
  definition: AutomationDefinition
  onClose: () => void
}

const LOG_STYLES: Record<StepLog['status'], { bg: string; icon: string; text: string }> = {
  success: { bg: 'bg-emerald-50 border-emerald-200', icon: '✓', text: 'text-emerald-700' },
  skipped: { bg: 'bg-amber-50 border-amber-200',    icon: '⏭', text: 'text-amber-700'  },
  error:   { bg: 'bg-red-50 border-red-200',         icon: '✕', text: 'text-red-600'    },
}

export function TestRunnerModal({ automationId, definition, onClose }: TestRunnerModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [running, setRunning] = useState(false)
  const [stepLogs, setStepLogs] = useState<StepLog[] | null>(null)
  const [error, setError] = useState('')
  const [testTaskIds, setTestTaskIds] = useState<string[]>([])
  const [clearingTasks, setClearingTasks] = useState(false)

  useEffect(() => {
    fetch('/api/contacts?pageSize=50')
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => {})
  }, [])

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    return !q || `${c.firstName} ${c.lastName} ${c.email ?? ''}`.toLowerCase().includes(q)
  })

  const handleRun = async () => {
    if (!selected) return
    setRunning(true)
    setError('')
    setStepLogs(null)

    try {
      const res = await fetch(`/api/automations/${automationId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: selected.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Test failed'); return }
      setStepLogs(data.stepLogs ?? [])

      // Collect any test task IDs from logs
      const taskIds = (data.stepLogs as StepLog[])
        .filter((l) => l.type === 'TASK' && l.status === 'success' && l.detail.startsWith('Test task created'))
        .map((l) => l.detail)
      setTestTaskIds(taskIds)
    } catch {
      setError('Network error — try again')
    } finally {
      setRunning(false)
    }
  }

  const handleClearTestTasks = async () => {
    if (!selected) return
    setClearingTasks(true)
    try {
      await fetch(`/api/tasks?contactId=${selected.id}&prefix=[TEST]`, { method: 'DELETE' })
      setTestTaskIds([])
    } catch { /* ignore */ }
    finally { setClearingTasks(false) }
  }

  const successCount = stepLogs?.filter((l) => l.status === 'success').length ?? 0
  const skippedCount = stepLogs?.filter((l) => l.status === 'skipped').length ?? 0
  const errorCount   = stepLogs?.filter((l) => l.status === 'error').length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-14">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Test Runner</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Test Mode — No real emails or SMS will be sent · WAIT steps skipped · Tasks created as [TEST]
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contact selector */}
        {!stepLogs && (
          <div className="p-6 space-y-4">
            <p className="text-sm font-medium text-gray-700">Select a contact to run against</p>
            <input
              type="text"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#415A77]/30"
            />
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-gray-100 p-1">
              {filtered.length === 0 && (
                <p className="text-xs text-gray-400 italic py-4 text-center">No contacts found</p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                    selected?.id === c.id ? 'bg-[#0D1B2A] text-white' : 'hover:bg-gray-50 text-gray-800'
                  )}
                >
                  <div className={cn('h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold',
                    selected?.id === c.id ? 'bg-white/15 text-white' : 'bg-[#415A77]/10 text-[#415A77]'
                  )}>
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                    {c.email && <p className={cn('text-xs truncate', selected?.id === c.id ? 'text-white/60' : 'text-gray-400')}>{c.email}</p>}
                  </div>
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                {selected && <span>Running as <span className="font-medium text-gray-700">{selected.firstName} {selected.lastName}</span></span>}
              </div>
              <button
                onClick={handleRun}
                disabled={!selected || running}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all',
                  selected && !running ? 'bg-[#0D1B2A] text-white hover:bg-[#1a2d42]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {running ? (
                  <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Running…</>
                ) : (
                  <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Run Test</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {stepLogs && (
          <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Passed',  value: successCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Skipped', value: skippedCount, color: 'text-amber-600',   bg: 'bg-amber-50'   },
                { label: 'Errors',  value: errorCount,   color: 'text-red-600',     bg: 'bg-red-50'     },
              ].map((s) => (
                <div key={s.label} className={cn('rounded-xl px-3 py-3 text-center', s.bg)}>
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Step-by-step */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stepLogs.map((log, i) => {
                const style = LOG_STYLES[log.status]
                return (
                  <div key={i} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', style.bg)}>
                    <span className={cn('font-bold text-sm mt-0.5 shrink-0', style.text)}>{style.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', style.text)}>{log.stepLabel}</p>
                      <p className={cn('text-xs mt-0.5 break-words', style.text, 'opacity-75')}>{log.detail}</p>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">{log.durationMs}ms</span>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                {testTaskIds.length > 0 && (
                  <button
                    onClick={handleClearTestTasks}
                    disabled={clearingTasks}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    {clearingTasks ? 'Clearing…' : `Clear ${testTaskIds.length} test task${testTaskIds.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
              <button
                onClick={() => { setStepLogs(null); setError('') }}
                className="flex items-center gap-1.5 text-sm text-[#415A77] hover:text-[#0D1B2A] font-medium"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Run Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
