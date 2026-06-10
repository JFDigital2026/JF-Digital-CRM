'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Building2, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { SlideOver } from '@/components/ui/slide-over'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { ContactSlideOver } from '@/components/contacts/contact-slide-over'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface OppSlideOverProps {
  oppId: string | null
  open: boolean
  onClose: () => void
  stages: Stage[]
  pipelineName: string
  onStageChange: (id: string, stageId: string) => void
  onDelete: (id: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

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

// ─── Inline editable cell ────────────────────────────────────────────────────

function InlineCell({
  display,
  inputType,
  inputValue,
  onSave,
  min,
  max,
}: {
  display: React.ReactNode
  inputType: 'number' | 'date'
  inputValue: string
  onSave: (v: string) => void
  min?: number
  max?: number
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(inputValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocal(inputValue)
  }, [inputValue])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (local !== inputValue) onSave(local)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={local}
        min={min}
        max={max}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setLocal(inputValue); setEditing(false) }
        }}
        className="w-32 rounded border border-[#415A77] px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#415A77]/20"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="cursor-text rounded px-1 py-0.5 text-sm text-gray-900 hover:bg-gray-100 transition-colors"
    >
      {display}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OppSlideOver({
  oppId,
  open,
  onClose,
  stages,
  onStageChange,
  onDelete,
}: OppSlideOverProps) {
  const router = useRouter()
  const [opp, setOpp] = useState<FullOpportunity | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contactSlideOverId, setContactSlideOverId] = useState<string | null>(null)

  // Notes textarea local state
  const [notesLocal, setNotesLocal] = useState('')

  useEffect(() => {
    if (!oppId) { setOpp(null); return }
    setLoading(true)
    fetch(`/api/opportunities/${oppId}`)
      .then((r) => r.json())
      .then((data: FullOpportunity) => {
        setOpp(data)
        setNotesLocal(data.notes ?? '')
      })
      .catch(() => setOpp(null))
      .finally(() => setLoading(false))
  }, [oppId])

  const patch = async (body: Record<string, unknown>) => {
    if (!opp) return
    const res = await fetch(`/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const updated = await res.json()
    setOpp((prev) => prev ? { ...prev, ...updated } : prev)
    return updated
  }

  const handleStageClick = async (stageId: string) => {
    if (!opp || stageId === opp.stageId) return
    await patch({ stageId })
    onStageChange(opp.id, stageId)
  }

  const handleDelete = async () => {
    if (!opp) return
    setDeleting(true)
    await fetch(`/api/opportunities/${opp.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteOpen(false)
    onDelete(opp.id)
    onClose()
  }

  const titleDisplay = opp?.title ?? (loading ? 'Loading…' : 'Deal Detail')

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={titleDisplay}
        width={480}
        headerAction={
          oppId ? (
            <a
              href={`/opportunities/${oppId}`}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={11} /> Open Full View
            </a>
          ) : undefined
        }
      >
        {loading && (
          <LoadingSkeleton variant="list" rows={4} className="p-5" />
        )}

        {!loading && opp && (
          <div className="flex flex-col gap-5 px-5 py-5">

            {/* ── 1. Deal Info card ──────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">

              {/* Stage pills */}
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">Stage</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {stages.map((s) => {
                    const active = s.id === opp.stageId
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleStageClick(s.id)}
                        style={active ? { backgroundColor: s.color ?? '#0D1B2A', borderColor: s.color ?? '#0D1B2A' } : { borderColor: '#e5e7eb' }}
                        className={cn(
                          'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'text-white'
                            : 'bg-white text-gray-600 hover:border-gray-400'
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
                </div>
              </div>

              {/* Value */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Value</p>
                <InlineCell
                  display={opp.value != null ? `$${opp.value.toLocaleString()}` : <span className="italic text-gray-400">—</span>}
                  inputType="number"
                  inputValue={opp.value != null ? String(opp.value) : ''}
                  onSave={(v) => patch({ value: v === '' ? null : Number(v) })}
                />
              </div>

              {/* Probability */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Probability</p>
                <div className="flex items-center gap-2">
                  {opp.probability != null && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', probBadgeClass(opp.probability))}>
                      {opp.probability}%
                    </span>
                  )}
                  <InlineCell
                    display={opp.probability != null ? `${opp.probability}%` : <span className="italic text-gray-400">—</span>}
                    inputType="number"
                    inputValue={opp.probability != null ? String(opp.probability) : ''}
                    onSave={(v) => patch({ probability: v === '' ? null : Number(v) })}
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              {/* Close date */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Close Date</p>
                <InlineCell
                  display={
                    opp.closeDate
                      ? format(new Date(opp.closeDate), 'MMM d, yyyy')
                      : <span className="italic text-gray-400">—</span>
                  }
                  inputType="date"
                  inputValue={opp.closeDate ? opp.closeDate.slice(0, 10) : ''}
                  onSave={(v) => patch({ closeDate: v || null })}
                />
              </div>
            </div>

            {/* ── 2. Contact + Company row ───────────────────────────────── */}
            <div className="flex gap-3 flex-wrap">
              {opp.contact ? (
                <button
                  onClick={() => setContactSlideOverId(opp.contact!.id)}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-[#415A77] hover:bg-gray-50 transition-colors"
                >
                  <CRMAvatar name={`${opp.contact.firstName} ${opp.contact.lastName}`} size="sm" />
                  {opp.contact.firstName} {opp.contact.lastName}
                </button>
              ) : null}

              {opp.company ? (
                <button
                  onClick={() => router.push(`/companies/${opp.company!.id}`)}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-[#415A77] hover:bg-gray-50 transition-colors"
                >
                  <Building2 size={14} className="text-gray-400 shrink-0" />
                  {opp.company.name}
                </button>
              ) : null}

              {!opp.contact && !opp.company && (
                <p className="text-sm italic text-gray-400">No contact or company linked</p>
              )}
            </div>

            {/* ── 3. Notes ──────────────────────────────────────────────── */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Notes</p>
              <textarea
                value={notesLocal}
                onChange={(e) => setNotesLocal(e.target.value)}
                onBlur={() => {
                  if (notesLocal !== (opp.notes ?? '')) patch({ notes: notesLocal })
                }}
                rows={3}
                placeholder="Add notes…"
                className={cn(inputClass, 'resize-none leading-relaxed')}
                style={{ minHeight: '4.5rem', fieldSizing: 'content' } as React.CSSProperties}
              />
            </div>

            {/* ── 4. Activity log ───────────────────────────────────────── */}
            <div>
              <p className="mb-3 text-xs font-medium text-gray-500">Activity</p>
              {!opp.activityLogs?.length ? (
                <EmptyState title="No activity yet" className="py-6" />
              ) : (
                <div className="flex flex-col">
                  {opp.activityLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex gap-3 border-b border-gray-50 py-2.5 last:border-0">
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
            </div>

            {/* ── 5. Footer actions ─────────────────────────────────────── */}
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} /> Delete Deal
              </button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Stacked ContactSlideOver — higher z-index via SlideOver portal */}
      <ContactSlideOver
        contactId={contactSlideOverId}
        onClose={() => setContactSlideOverId(null)}
        onEdit={() => {}}
      />

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
    </>
  )
}
