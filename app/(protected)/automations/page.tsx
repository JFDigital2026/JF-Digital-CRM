'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { ActionMenu } from '@/components/ui/action-menu'
import { TRIGGER_LABELS } from '@/lib/automation-types'
import { cn } from '@/lib/utils'

type Automation = {
  id: string
  name: string
  description: string | null
  sourceFile: string | null
  trigger: string
  active: boolean
  syncStatus: string
  lastSyncedAt: string | null
  lastRunAt: string | null
  createdAt: string
  successCount: number
  failureCount: number
  stepCount: number
}

const TRIGGER_COLORS: Record<string, string> = {
  CONTACT_CREATED: 'bg-blue-100 text-blue-700',
  APPOINTMENT_BOOKED: 'bg-purple-100 text-purple-700',
  APPOINTMENT_NO_SHOW: 'bg-red-100 text-red-700',
  OPPORTUNITY_STAGE_CHANGED: 'bg-orange-100 text-orange-700',
  PAYMENT_RECEIVED: 'bg-emerald-100 text-emerald-700',
  PAYMENT_FAILED: 'bg-red-100 text-red-700',
  TAG_ADDED: 'bg-teal-100 text-teal-700',
  TASK_COMPLETED: 'bg-indigo-100 text-indigo-700',
  MANUAL: 'bg-gray-100 text-gray-600',
}

const SYNC_STATUS_VARIANTS: Record<string, { label: string; classes: string }> = {
  SYNCED: { label: 'Synced', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SCHEMA_ERROR: { label: 'Schema Error', classes: 'bg-red-50 text-red-600 border-red-200' },
  FILE_MISSING: { label: 'File Missing', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none',
        checked ? 'bg-[#0D1B2A]' : 'bg-gray-200'
      )}
    >
      <span className={cn('pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

function timeAgo(d: string | null): string {
  if (!d) return 'Never'
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(d).toLocaleDateString()
}

export default function AutomationsPage() {
  const router = useRouter()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      const data = await res.json()
      setAutomations(data.automations ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/automations/sync', { method: 'POST' })
      const data = await res.json()
      setLastSyncedAt(data.syncedAt)
      await load()
    } finally {
      setSyncing(false)
    }
  }

  const handleToggle = async (auto: Automation, active: boolean) => {
    setAutomations((prev) => prev.map((a) => a.id === auto.id ? { ...a, active } : a))
    await fetch(`/api/automations/${auto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
  }

  const syncedCount = automations.filter((a) => a.syncStatus === 'SYNCED').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Automations"
        subtitle="Trigger-based workflows defined in /automations/*.json"
        actions={
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-[#415A77]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#415A77] hover:bg-[#415A77]/5 transition-colors disabled:opacity-50"
          >
            <svg className={cn('h-4 w-4', syncing && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing…' : 'Refresh Sync'}
          </button>
        }
      />

      {/* Sync status bar */}
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-[#0D1B2A]/3 border border-[#415A77]/10 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-sm text-gray-700">
          <span className="font-medium">{syncedCount} automation{syncedCount !== 1 ? 's' : ''}</span>{' '}
          synced from <code className="text-xs bg-white border border-gray-200 rounded px-1 py-0.5 font-mono">/automations/</code>
        </p>
        {(lastSyncedAt ?? automations[0]?.lastSyncedAt) && (
          <p className="ml-auto text-xs text-gray-400">
            Last synced {timeAgo(lastSyncedAt ?? automations[0]?.lastSyncedAt ?? null)}
          </p>
        )}
      </div>

      {/* Automation cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-gray-100 bg-white animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#415A77]/10">
            <svg className="h-7 w-7 text-[#415A77]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No automations found</h3>
          <p className="text-sm text-gray-500 mb-3 max-w-sm">
            Create a <code className="text-xs bg-gray-100 rounded px-1 font-mono">.json</code> file in the{' '}
            <code className="text-xs bg-gray-100 rounded px-1 font-mono">/automations/</code> folder, then click Refresh Sync.
          </p>
          <button onClick={handleSync} className="text-sm text-[#415A77] hover:underline">
            Scan now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((auto) => {
            const syncVariant = SYNC_STATUS_VARIANTS[auto.syncStatus] ?? SYNC_STATUS_VARIANTS.SYNCED
            return (
              <div
                key={auto.id}
                className="group relative flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
                onClick={() => router.push(`/automations/${auto.id}`)}
              >
                {/* Active dot */}
                <div className={cn('absolute top-4 left-4 h-1.5 w-1.5 rounded-full', auto.active ? 'bg-emerald-400' : 'bg-gray-300')} />

                {/* Header */}
                <div className="flex items-start justify-between mb-2 pl-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate leading-tight">{auto.name}</h3>
                    {auto.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{auto.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Toggle checked={auto.active} onChange={(v) => handleToggle(auto, v)} />
                    <ActionMenu
                      items={[
                        { label: 'View', onClick: () => router.push(`/automations/${auto.id}`) },
                        { label: 'Test', onClick: () => router.push(`/automations/${auto.id}?test=1`) },
                        { label: 'View Logs', onClick: () => router.push(`/automations/${auto.id}/logs`) },
                        { label: auto.active ? 'Deactivate' : 'Activate', onClick: () => handleToggle(auto, !auto.active) },
                      ]}
                    />
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3 pl-3">
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', TRIGGER_COLORS[auto.trigger] ?? 'bg-gray-100 text-gray-600')}>
                    {(TRIGGER_LABELS as Record<string, string>)[auto.trigger] ?? auto.trigger}
                  </span>
                  {auto.sourceFile && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-500">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {auto.sourceFile}
                    </span>
                  )}
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold', syncVariant.classes)}>
                    {syncVariant.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-gray-50 pl-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Steps</p>
                    <p className="text-sm font-semibold text-gray-800">{auto.stepCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Success</p>
                    <p className="text-sm font-semibold text-emerald-600">{auto.successCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Failed</p>
                    <p className="text-sm font-semibold text-red-500">{auto.failureCount}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-gray-400 pl-3">Last run: {timeAgo(auto.lastRunAt)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer hint */}
      <div className="mt-8 rounded-xl bg-[#0D1B2A]/2 border border-[#415A77]/8 px-5 py-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-semibold text-gray-700">Automations are created in Claude Code.</span>{' '}
          Drop a <code className="font-mono bg-white border border-gray-200 rounded px-1">.json</code> file into{' '}
          <code className="font-mono bg-white border border-gray-200 rounded px-1">/automations/</code> and the watcher syncs it automatically.
          To delete an automation, remove the file — deletion from the UI is not supported.
        </p>
      </div>
    </div>
  )
}
