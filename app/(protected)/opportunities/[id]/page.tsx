'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { InlineField } from '@/components/contacts/inline-field'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = { id: string; name: string; color: string | null; order: number }

type ActivityLog = {
  id: string
  type: string
  description: string
  createdAt: string
  user?: { name?: string | null }
}

type FullOpportunity = {
  id: string
  title: string
  value?: number | null
  probability?: number | null
  closeDate?: string | null
  notes?: string | null
  outcome?: 'WON' | 'LOST' | 'ABANDONED' | null
  wonAmount?: number | null
  outcomeReason?: string | null
  stageId: string
  pipelineId: string
  assignedTo?: string | null
  contact?: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; title?: string | null } | null
  company?: { id: string; name: string; website?: string | null } | null
  stage?: { id: string; name: string; color: string | null } | null
  pipeline?: { id: string; name: string } | null
  activityLogs?: ActivityLog[]
  createdAt: string
  updatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

const OUTCOME_BADGE: Record<string, string> = {
  WON: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-600',
  ABANDONED: 'bg-gray-200 text-gray-600',
}
const OUTCOME_LABEL: Record<string, string> = {
  WON: 'Won', LOST: 'Lost', ABANDONED: 'Abandoned',
}

function probBadgeClass(p: number) {
  if (p >= 70) return 'bg-emerald-100 text-emerald-700'
  if (p >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

function activityDotClass(type: string) {
  if (type.startsWith('opportunity.')) return 'bg-[#0D1B2A]'
  if (type.startsWith('contact.')) return 'bg-blue-500'
  if (type.startsWith('task.')) return 'bg-amber-400'
  return 'bg-gray-300'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()

  const [opp, setOpp] = useState<FullOpportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState<Stage[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load opportunity
  useEffect(() => {
    setLoading(true)
    fetch(`/api/opportunities/${id}`)
      .then((r) => r.json())
      .then((data: FullOpportunity) => {
        setOpp(data)
        setLoading(false)
        // Then load all stages for this pipeline
        if (data.pipelineId) {
          fetch(`/api/stages?pipelineId=${data.pipelineId}`)
            .then((r) => r.json())
            .then((s: Stage[]) => setStages(s))
            .catch(() => {})
        }
      })
      .catch(() => setLoading(false))
  }, [id])

  const patch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const updated = await res.json()
    setOpp((prev) => prev ? { ...prev, ...updated } : prev)
  }, [id])

  const handleStageClick = (stageId: string) => {
    if (!opp || stageId === opp.stageId) return
    patch({ stageId })
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/opportunities/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteOpen(false)
    router.push('/pipeline')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6">
        <LoadingSkeleton variant="list" rows={6} />
      </div>
    )
  }

  if (!opp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <EmptyState title="Deal not found" description="This opportunity may have been deleted." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
        <button
          onClick={() => router.push('/pipeline')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={15} />
          Pipeline
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900 truncate">{opp.title}</span>
      </div>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* Deal title */}
        <div className="mb-8">
          <InlineField
            label=""
            value={opp.title}
            onSave={(v) => patch({ title: v })}
            placeholder="Deal title…"
            className="[&>div]:text-2xl [&>div]:font-bold [&>div]:text-gray-900 [&_input]:text-2xl [&_input]:font-bold"
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">

          {/* ── Left column (60%) ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Deal Info card */}
            <section className="rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Deal Info</h2>

              <InlineField
                label="Title"
                value={opp.title}
                onSave={(v) => patch({ title: v })}
              />

              <InlineField
                label="Value"
                value={opp.value != null ? String(opp.value) : ''}
                onSave={(v) => patch({ value: v === '' ? null : Number(v) })}
                placeholder="e.g. 5000"
              />

              <InlineField
                label="Probability (%)"
                value={opp.probability != null ? String(opp.probability) : ''}
                onSave={(v) => patch({ probability: v === '' ? null : Math.min(100, Math.max(0, Number(v))) })}
                placeholder="0–100"
              />

              <InlineField
                label="Close Date"
                value={opp.closeDate ? opp.closeDate.slice(0, 10) : ''}
                onSave={(v) => patch({ closeDate: v || null })}
                placeholder="YYYY-MM-DD"
              />

              <InlineField
                label="Notes"
                value={opp.notes ?? ''}
                onSave={(v) => patch({ notes: v })}
                type="textarea"
                placeholder="Add deal notes…"
              />
            </section>

            {/* Stage selector */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Stage</h2>
              <div className="flex flex-wrap gap-2">
                {stages.map((s) => {
                  const active = s.id === opp.stageId
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleStageClick(s.id)}
                      style={
                        active
                          ? { backgroundColor: s.color ?? '#0D1B2A', borderColor: s.color ?? '#0D1B2A' }
                          : { borderColor: '#e5e7eb' }
                      }
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                        active ? 'text-white' : 'bg-white text-gray-600 hover:border-gray-400'
                      )}
                      onMouseEnter={(e) => {
                        if (!active && s.color) (e.currentTarget as HTMLButtonElement).style.borderColor = s.color
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'
                      }}
                    >
                      {s.name}
                    </button>
                  )
                })}
                {stages.length === 0 && (
                  <p className="text-sm italic text-gray-400">No stages available</p>
                )}
              </div>
            </section>

            {/* Outcome section */}
            {opp.outcome && (
              <section className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Outcome</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn('rounded-full px-3 py-1 text-sm font-bold', OUTCOME_BADGE[opp.outcome])}>
                    {OUTCOME_LABEL[opp.outcome]}
                  </span>
                  {opp.outcome === 'WON' && opp.wonAmount != null && (
                    <span className="text-sm font-semibold text-emerald-700">
                      ${opp.wonAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                {opp.outcomeReason && (
                  <p className="mt-2 text-sm text-gray-500">Reason: {opp.outcomeReason}</p>
                )}
              </section>
            )}

          </div>

          {/* ── Right column (40%) ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Contact chip */}
            {opp.contact && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</h2>
                <button
                  onClick={() => router.push(`/contacts/${opp.contact!.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left hover:border-[#415A77] hover:bg-white transition-colors"
                >
                  <CRMAvatar name={`${opp.contact.firstName} ${opp.contact.lastName}`} size="default" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {opp.contact.firstName} {opp.contact.lastName}
                    </p>
                    {opp.contact.title && (
                      <p className="text-xs text-gray-500">{opp.contact.title}</p>
                    )}
                    {opp.contact.email && (
                      <p className="truncate text-xs text-gray-400">{opp.contact.email}</p>
                    )}
                  </div>
                </button>
              </section>
            )}

            {/* Company chip */}
            {opp.company && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Company</h2>
                <button
                  onClick={() => router.push(`/companies/${opp.company!.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left hover:border-[#415A77] hover:bg-white transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                    <Building2 size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{opp.company.name}</p>
                    {opp.company.website && (
                      <p className="truncate text-xs text-gray-400">{opp.company.website}</p>
                    )}
                  </div>
                </button>
              </section>
            )}

            {/* Pipeline info */}
            <section className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Pipeline</h2>
              <div>
                <p className="text-xs text-gray-500">Pipeline</p>
                <p className="text-sm font-medium text-gray-900">{opp.pipeline?.name ?? '—'}</p>
              </div>
              {opp.probability != null && (
                <div>
                  <p className="text-xs text-gray-500">Probability</p>
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', probBadgeClass(opp.probability))}>
                    {opp.probability}%
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm text-gray-700">{format(new Date(opp.createdAt), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last updated</p>
                <p className="text-sm text-gray-700">{formatDistanceToNow(new Date(opp.updatedAt), { addSuffix: true })}</p>
              </div>
            </section>

            {/* Activity timeline */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Activity</h2>
              {!opp.activityLogs?.length ? (
                <EmptyState title="No activity yet" className="py-6" />
              ) : (
                <div className="flex flex-col">
                  {opp.activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 border-b border-gray-50 py-3 last:border-0">
                      <div className="mt-1.5 shrink-0">
                        <div className={cn('h-2 w-2 rounded-full', activityDotClass(log.type))} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">{log.description}</p>
                        <p className="text-xs text-gray-400">
                          {log.user?.name ? `${log.user.name} · ` : ''}
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Delete */}
            <section className="border-t border-gray-100 pt-4">
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Delete Deal
              </button>
            </section>

          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this deal?"
        description="This will permanently remove the deal and all associated activity. This cannot be undone."
        confirmLabel="Delete Deal"
        destructive
        loading={deleting}
      />
    </div>
  )
}
