'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, X, DollarSign, Trophy, Archive, ThumbsDown, Settings, Trash2, ChevronUp, ChevronDown, List, LayoutGrid, SlidersHorizontal, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { SlideOver } from '@/components/ui/slide-over'
import { DataTable, type TableColumn } from '@/components/ui/data-table'
// @ts-ignore
import { OppSlideOver } from '@/components/pipeline/opportunity-slide-over'

// ─── Types ─────────────────────────────────────────────────────────────────

type Stage = { id: string; name: string; color: string | null; order: number }
type Opportunity = {
  id: string
  title: string
  value?: number
  wonAmount?: number
  probability?: number
  closeDate?: string
  stageId: string
  outcome?: 'WON' | 'LOST' | 'ABANDONED' | null
  outcomeReason?: string | null
  contact?: { id: string; firstName: string; lastName: string }
  company?: { id: string; name: string; address?: string; city?: string; state?: string; website?: string }
}
type Pipeline = { id: string; name: string; stages: Stage[] }

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

// ─── localStorage helpers ──────────────────────────────────────────────────

function getStoredReasons(type: 'abandoned' | 'lost'): string[] {
  try { return JSON.parse(localStorage.getItem(`crm_${type}_reasons`) ?? '[]') } catch { return [] }
}
function saveReason(type: 'abandoned' | 'lost', reason: string) {
  if (!reason.trim()) return
  const existing = getStoredReasons(type)
  if (!existing.includes(reason)) {
    localStorage.setItem(`crm_${type}_reasons`, JSON.stringify([reason, ...existing].slice(0, 20)))
  }
}

// ─── Outcome colours ───────────────────────────────────────────────────────

const OUTCOME_TINT: Record<string, string> = {
  WON: 'bg-emerald-50 border-emerald-200',
  LOST: 'bg-red-50 border-red-200',
  ABANDONED: 'bg-gray-100 border-gray-300',
}
const OUTCOME_TAG: Record<string, string> = {
  WON: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-600',
  ABANDONED: 'bg-gray-200 text-gray-600',
}
const OUTCOME_LABEL: Record<string, string> = { WON: 'Won', LOST: 'Lost', ABANDONED: 'Abandoned' }

// ─── Main component ────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [activePipelineId, setActivePipelineId] = useState<string>('')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  // Add View modal
  const [showAddView, setShowAddView] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [creatingView, setCreatingView] = useState(false)
  const [newViewStages, setNewViewStages] = useState([
    { name: 'Lead', color: '#415A77' },
    { name: 'In Progress', color: '#E9C46A' },
    { name: 'Qualified', color: '#2A9D8F' },
    { name: 'Closed', color: '#E76F51' },
  ])

  // Add Deal modal
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [newDealStageId, setNewDealStageId] = useState('')
  const [newForm, setNewForm] = useState({ title: '', value: '', probability: '', closeDate: '', contactSearch: '', companySearch: '' })
  const [newContact, setNewContact] = useState<any>(null)
  const [newCompany, setNewCompany] = useState<any>(null)
  const [contactResults, setContactResults] = useState<any[]>([])
  const [companyResults, setCompanyResults] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  // Outcome popups
  const [outcomeTarget, setOutcomeTarget] = useState<{ oppId: string; type: 'WON' | 'LOST' | 'ABANDONED' } | null>(null)
  const [wonAmount, setWonAmount] = useState('')
  const [outcomeReason, setOutcomeReason] = useState('')
  const [reasonSuggestions, setReasonSuggestions] = useState<string[]>([])

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // (card detail panel replaced by OppSlideOver)

  // Drag state
  const dragCard = useRef<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pipeline settings
  const [showSettings, setShowSettings] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsStages, setSettingsStages] = useState<{ id?: string; name: string; color: string; order: number }[]>([])
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [confirmDeletePipeline, setConfirmDeletePipeline] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // Manage Pipelines slide-over
  const [showManage, setShowManage] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')

  // Filters
  const [filterCloseDateFrom, setFilterCloseDateFrom] = useState('')
  const [filterCloseDateTo, setFilterCloseDateTo] = useState('')
  const [filterValueMin, setFilterValueMin] = useState('')
  const [filterValueMax, setFilterValueMax] = useState('')
  const [filterProbMin, setFilterProbMin] = useState('')
  const [filterProbMax, setFilterProbMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // OppSlideOver
  const [slideOverOppId, setSlideOverOppId] = useState<string | null>(null)

  // ─── Data fetching ─────────────────────────────────────────────────────

  const fetchPipelines = async () => {
    const res = await fetch('/api/pipelines')
    const data = await res.json()
    setPipelines(data)
    if (data.length > 0 && !activePipelineId) setActivePipelineId(data[0].id)
  }

  const fetchOpportunities = useCallback(async (pipelineId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/opportunities?pipelineId=${pipelineId}`)
      const data = res.ok ? await res.json() : {}
      setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : [])
    } catch {
      setOpportunities([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPipelines() }, [])
  useEffect(() => { if (activePipelineId) fetchOpportunities(activePipelineId) }, [activePipelineId, fetchOpportunities])

  const activePipeline = pipelines.find((p) => p.id === activePipelineId)

  // ─── Filters ──────────────────────────────────────────────────────────
  const filteredOpps = opportunities.filter((o) => {
    if (filterCloseDateFrom && o.closeDate && new Date(o.closeDate) < new Date(filterCloseDateFrom)) return false
    if (filterCloseDateTo && o.closeDate && new Date(o.closeDate) > new Date(filterCloseDateTo)) return false
    if (filterValueMin && (o.value ?? 0) < parseFloat(filterValueMin)) return false
    if (filterValueMax && (o.value ?? 0) > parseFloat(filterValueMax)) return false
    if (filterProbMin && (o.probability ?? 0) < parseFloat(filterProbMin)) return false
    if (filterProbMax && (o.probability ?? 0) > parseFloat(filterProbMax)) return false
    return true
  })

  const oppsByStage = (stageId: string) => filteredOpps.filter((o) => o.stageId === stageId)
  const stageValue = (stageId: string) =>
    oppsByStage(stageId).reduce((sum, o) => sum + (o.value ?? 0), 0)

  // ─── Add View ─────────────────────────────────────────────────────────

  const defaultViewStages = [
    { name: 'Lead', color: '#415A77' },
    { name: 'In Progress', color: '#E9C46A' },
    { name: 'Qualified', color: '#2A9D8F' },
    { name: 'Closed', color: '#E76F51' },
  ]

  const handleCreateView = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newViewName.trim()) return
    setCreatingView(true)
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newViewName.trim(),
        stages: newViewStages.map((s, i) => ({ name: s.name, color: s.color, order: i + 1 })),
      }),
    })
    const created = await res.json()
    setNewViewName('')
    setNewViewStages(defaultViewStages)
    setCreatingView(false)
    setShowAddView(false)
    await fetchPipelines()
    setActivePipelineId(created.id)
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────

  const handleDrop = async (stageId: string) => {
    const id = dragCard.current
    setDragOver(null)
    if (!id) return
    const opp = opportunities.find((o) => o.id === id)
    if (!opp || opp.stageId === stageId) return

    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, stageId } : o))
    await fetch(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId }),
    })
    dragCard.current = null
  }

  const handleDropOutcome = (type: 'WON' | 'LOST' | 'ABANDONED') => {
    const id = dragCard.current
    setDragOver(null)
    if (!id) return
    dragCard.current = null
    setOutcomeTarget({ oppId: id, type })
    setWonAmount('')
    setOutcomeReason('')
    if (type !== 'WON') {
      setReasonSuggestions(getStoredReasons(type === 'ABANDONED' ? 'abandoned' : 'lost'))
    }
  }

  const submitOutcome = async () => {
    if (!outcomeTarget) return
    const { oppId, type } = outcomeTarget
    if (type !== 'WON' && outcomeReason.trim()) {
      saveReason(type === 'ABANDONED' ? 'abandoned' : 'lost', outcomeReason.trim())
    }
    const body: any = { outcome: type }
    if (type === 'WON') body.wonAmount = wonAmount ? parseFloat(wonAmount) : null
    else body.outcomeReason = outcomeReason || null

    setOpportunities((prev) =>
      prev.map((o) => o.id === oppId
        ? { ...o, outcome: type, wonAmount: type === 'WON' ? (wonAmount ? parseFloat(wonAmount) : undefined) : o.wonAmount, outcomeReason: type !== 'WON' ? outcomeReason : o.outcomeReason }
        : o
      )
    )
    await fetch(`/api/opportunities/${oppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setOutcomeTarget(null)
  }

  // ─── Pipeline settings ─────────────────────────────────────────────────

  const openSettings = () => {
    if (!activePipeline) return
    setSettingsName(activePipeline.name)
    setSettingsStages(activePipeline.stages.map((s, i) => ({ id: s.id, name: s.name, color: s.color ?? '#415A77', order: i + 1 })))
    setShowSettings(true)
  }

  const saveSettings = async () => {
    if (!activePipelineId) return
    setSettingsSaving(true)
    const res = await fetch(`/api/pipelines/${activePipelineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: settingsName, stages: settingsStages.map((s, i) => ({ ...s, order: i + 1 })) }),
    })
    const updated = res.ok ? await res.json() : null
    if (updated) {
      setPipelines((prev) => prev.map((p) => p.id === activePipelineId ? updated : p))
    }
    setSettingsSaving(false)
    setShowSettings(false)
    fetchOpportunities(activePipelineId)
  }

  const deletePipeline = async () => {
    if (!activePipelineId) return
    await fetch(`/api/pipelines/${activePipelineId}`, { method: 'DELETE' })
    const remaining = pipelines.filter((p) => p.id !== activePipelineId)
    setPipelines(remaining)
    setActivePipelineId(remaining[0]?.id ?? '')
    setOpportunities([])
    setShowSettings(false)
    setConfirmDeletePipeline(false)
  }

  // ─── Add Deal ─────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDealStageId) return
    // Auto-generate title from contact or company if not provided
    const autoTitle = newForm.title.trim()
      || (newContact ? `${newContact.firstName} ${newContact.lastName}` : '')
      || (newCompany ? newCompany.name : '')
      || 'New Deal'
    if (!autoTitle) return
    setCreating(true)
    await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: autoTitle,
        value: newForm.value || null,
        probability: newForm.probability || null,
        closeDate: newForm.closeDate || null,
        stageId: newDealStageId,
        pipelineId: activePipelineId,
        contactId: newContact?.id || null,
        companyId: newCompany?.id || null,
      }),
    })
    setCreating(false)
    setShowNewDeal(false)
    setNewForm({ title: '', value: '', probability: '', closeDate: '', contactSearch: '', companySearch: '' })
    setNewContact(null); setNewCompany(null)
    fetchOpportunities(activePipelineId)
  }

  const doSearch = (type: 'contact' | 'company', q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { type === 'contact' ? setContactResults([]) : setCompanyResults([]); return }
    searchTimer.current = setTimeout(async () => {
      if (type === 'contact') {
        const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=5`)
        const data = await res.json()
        setContactResults(data.contacts ?? [])
      } else {
        const res = await fetch(`/api/companies?search=${encodeURIComponent(q)}&typeahead=true`)
        const data = await res.json()
        setCompanyResults(Array.isArray(data) ? data : [])
      }
    }, 250)
  }

  // ─── Card panel ───────────────────────────────────────────────────────

  const openCard = (opp: Opportunity) => {
    setSlideOverOppId(opp.id)
  }

  const removeFromPipeline = async (oppId: string) => {
    setDeleteId(null)
    await fetch(`/api/opportunities/${oppId}`, { method: 'DELETE' })
    setOpportunities((prev) => prev.filter((o) => o.id !== oppId))
  }

  const pipelineTotal = filteredOpps.reduce((sum, o) => sum + (o.value ?? 0), 0)
  const wonCount = opportunities.filter((o) => o.outcome === 'WON').length
  const lostCount = opportunities.filter((o) => o.outcome === 'LOST').length
  const abandonedCount = opportunities.filter((o) => o.outcome === 'ABANDONED').length

  // ─── List view columns ────────────────────────────────────────────────
  const listColumns: TableColumn<Opportunity>[] = [
    {
      key: 'title',
      header: 'Deal',
      render: (row) => <span className="font-medium text-gray-900">{row.title}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (row) => row.contact
        ? <span className="text-sm text-gray-700">{row.contact.firstName} {row.contact.lastName}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'company',
      header: 'Company',
      render: (row) => <span className="text-sm text-gray-600">{row.company?.name ?? '—'}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) => {
        const stage = activePipeline?.stages.find((s) => s.id === row.stageId)
        return stage ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: (stage.color ?? '#415A77') + '20', color: stage.color ?? '#415A77' }}
          >
            {stage.name}
          </span>
        ) : <span className="text-gray-400">—</span>
      },
    },
    {
      key: 'value',
      header: 'Value',
      render: (row) => row.value != null
        ? <span className="text-sm font-semibold text-gray-900">${row.value.toLocaleString()}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'probability',
      header: 'Prob.',
      render: (row) => {
        if (row.probability == null) return <span className="text-gray-400">—</span>
        const p = row.probability
        const cls = p >= 70 ? 'text-emerald-600 bg-emerald-50' : p >= 40 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
        return <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', cls)}>{p}%</span>
      },
    },
    {
      key: 'closeDate',
      header: 'Close Date',
      render: (row) => {
        if (!row.closeDate) return <span className="text-gray-400">—</span>
        const d = new Date(row.closeDate)
        const isPast = d < new Date()
        return <span className={cn('text-sm', isPast ? 'text-red-500 font-medium' : 'text-gray-600')}>{format(d, 'MMM d, yyyy')}</span>
      },
    },
  ]

  return (
    <div className="flex h-full">
      {/* Main kanban area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-100 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Pipeline selector on left */}
            <select
              value={activePipelineId}
              onChange={(e) => setActivePipelineId(e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#415A77]"
            >
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
              <p className="text-sm text-gray-500">{opportunities.length} deals · ${pipelineTotal.toLocaleString()} total</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Pipeline settings */}
            <button
              onClick={openSettings}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              title="Pipeline Settings"
            >
              <Settings size={15} />
            </button>
            {/* Manage Pipelines */}
            <button
              onClick={() => setShowManage(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Manage
            </button>
            {/* Kanban / List toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('kanban')}
                className={cn('px-2.5 py-2 text-sm', viewMode === 'kanban' ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-50')}
                title="Kanban view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('px-2.5 py-2 text-sm border-l border-gray-200', viewMode === 'list' ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-50')}
                title="List view"
              >
                <List size={15} />
              </button>
            </div>
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors',
                showFilters ? 'border-[#415A77] bg-[#415A77]/5 text-[#415A77]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <SlidersHorizontal size={15} />
            </button>
            {/* Add Deal (secondary style) */}
            <button
              onClick={() => { setNewDealStageId(activePipeline?.stages[0]?.id ?? ''); setShowNewDeal(true) }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Add Deal</span>
            </button>
            {/* Add View (primary) */}
            <button
              onClick={() => setShowAddView(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-2.5 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Add View</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="border-b border-gray-100 bg-gray-50 px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Close date</label>
              <input type="date" value={filterCloseDateFrom} onChange={(e) => setFilterCloseDateFrom(e.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
              <span className="text-xs text-gray-400">–</span>
              <input type="date" value={filterCloseDateTo} onChange={(e) => setFilterCloseDateTo(e.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Value ($)</label>
              <input type="number" placeholder="Min" value={filterValueMin} onChange={(e) => setFilterValueMin(e.target.value)}
                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
              <span className="text-xs text-gray-400">–</span>
              <input type="number" placeholder="Max" value={filterValueMax} onChange={(e) => setFilterValueMax(e.target.value)}
                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Probability (%)</label>
              <input type="number" min="0" max="100" placeholder="Min" value={filterProbMin} onChange={(e) => setFilterProbMin(e.target.value)}
                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
              <span className="text-xs text-gray-400">–</span>
              <input type="number" min="0" max="100" placeholder="Max" value={filterProbMax} onChange={(e) => setFilterProbMax(e.target.value)}
                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
            </div>
            <button
              onClick={() => { setFilterCloseDateFrom(''); setFilterCloseDateTo(''); setFilterValueMin(''); setFilterValueMax(''); setFilterProbMin(''); setFilterProbMax('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Kanban + outcome zones */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {viewMode === 'kanban' ? (
          <>
          {/* Kanban columns */}
          <div className="flex flex-1 gap-3 overflow-x-auto px-3 sm:px-6 py-3 sm:py-4 min-h-0">
            {activePipeline?.stages.map((stage) => {
              const cards = oppsByStage(stage.id)
              const val = stageValue(stage.id)
              const isOver = dragOver === stage.id
              return (
                <div
                  key={stage.id}
                  className={cn(
                    'flex w-60 shrink-0 flex-col rounded-xl border bg-gray-50 transition-colors',
                    isOver ? 'border-[#415A77] bg-[#415A77]/5' : 'border-gray-100'
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(stage.id)}
                >
                  {/* Stage header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: stage.color ?? '#415A77' }} />
                      <span className="text-xs font-semibold text-gray-700">{stage.name}</span>
                      <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{cards.length}</span>
                    </div>
                    {val > 0 && (
                      <span className="text-[10px] font-semibold text-gray-500">
                        ${val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0)}
                      </span>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                    <AnimatePresence>
                      {cards.map((opp) => (
                        <motion.div
                          key={opp.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); dragCard.current = opp.id }}
                          onDragEnd={() => { dragCard.current = null }}
                          onClick={() => openCard(opp)}
                          className={cn(
                            'group rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition-all',
                            opp.outcome ? OUTCOME_TINT[opp.outcome] : 'bg-white border-gray-200 hover:border-[#415A77]/30'
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-medium text-gray-900 leading-snug flex-1">{opp.title}</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteId(opp.id) }}
                              className="shrink-0 rounded p-0.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-50 transition-all"
                            >
                              <X size={11} />
                            </button>
                          </div>

                          {/* Outcome tag */}
                          {opp.outcome && (
                            <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold', OUTCOME_TAG[opp.outcome])}>
                              {OUTCOME_LABEL[opp.outcome]}
                              {opp.outcome === 'WON' && opp.wonAmount != null && ` · $${opp.wonAmount.toLocaleString()}`}
                            </span>
                          )}

                          {opp.value != null && !opp.outcome && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-gray-700">
                              <DollarSign size={10} className="text-gray-400" />
                              {opp.value.toLocaleString()}
                            </div>
                          )}

                          {(opp.contact || opp.company) && (
                            <p className="mt-1 text-[11px] text-gray-400">
                              {opp.contact ? `${opp.contact.firstName} ${opp.contact.lastName}` : opp.company?.name}
                            </p>
                          )}

                          {opp.closeDate && (
                            <p className="mt-0.5 text-[10px] text-gray-400">
                              Close: {format(new Date(opp.closeDate), 'MMM d')}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Per-column add button */}
                    <button
                      onClick={() => { setNewDealStageId(stage.id); setShowNewDeal(true) }}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors justify-center"
                    >
                      <Plus size={12} /> Add deal
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Won / Abandoned / Lost drop zones */}
          <div className="shrink-0 border-t border-gray-100 bg-white px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-2">Drop to mark:</span>
              {(
                [
                  { type: 'WON', label: 'Won', icon: Trophy, color: 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100', badge: wonCount },
                  { type: 'ABANDONED', label: 'Abandoned', icon: Archive, color: 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100', badge: abandonedCount },
                  { type: 'LOST', label: 'Lost', icon: ThumbsDown, color: 'border-red-300 bg-red-50 text-red-500 hover:bg-red-100', badge: lostCount },
                ] as const
              ).map(({ type, label, icon: Icon, color, badge }) => (
                <div
                  key={type}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(type) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDropOutcome(type)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 border-dashed px-4 py-2 transition-all cursor-default',
                    color,
                    dragOver === type && 'scale-105 shadow-md'
                  )}
                >
                  <Icon size={14} />
                  <span className="text-xs font-semibold">{label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold">{badge}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          </>
          ) : (
            /* List view */
            <div className="flex-1 overflow-auto px-3 sm:px-6 py-3 sm:py-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <DataTable<any>
                columns={listColumns as any}
                data={filteredOpps}
                loading={loading}
                onRowClick={(row: Opportunity) => setSlideOverOppId(row.id)}
                getRowId={(row: Opportunity) => row.id}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Add View modal ─────────────────────────────────────────────── */}
      <Modal open={showAddView} onClose={() => { setShowAddView(false); setNewViewName(''); setNewViewStages(defaultViewStages) }} title="Create Pipeline View" size="md">
        <form onSubmit={handleCreateView} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Pipeline Name *</label>
            <input
              autoFocus
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. Real Estate, Partnerships…"
              className={inputClass}
            />
          </div>

          {/* Stages section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Stages</label>
              <button
                type="button"
                onClick={() => setNewViewStages((prev) => [...prev, { name: '', color: '#415A77' }])}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Plus size={12} /> Add Stage
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {newViewStages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => setNewViewStages((prev) => prev.map((s, idx) => idx === i ? { ...s, color: e.target.value } : s))}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-200 p-0.5"
                    title="Stage color"
                  />
                  <input
                    value={stage.name}
                    onChange={(e) => setNewViewStages((prev) => prev.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s))}
                    placeholder="Stage name…"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={newViewStages.length <= 1}
                    onClick={() => setNewViewStages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Remove stage"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => { setShowAddView(false); setNewViewName(''); setNewViewStages(defaultViewStages) }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" disabled={creatingView} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
              {creatingView ? 'Creating…' : 'Create Pipeline'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Add Deal modal ─────────────────────────────────────────────── */}
      <Modal open={showNewDeal} onClose={() => setShowNewDeal(false)} title="Add Deal" size="md">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Deal Title <span className="text-gray-400 font-normal">(optional)</span></label>
            <input autoFocus value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))} placeholder="Auto-generated from contact or company name" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Stage</label>
              <select value={newDealStageId} onChange={(e) => setNewDealStageId(e.target.value)} className={inputClass}>
                {activePipeline?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Value ($)</label>
              <input type="number" value={newForm.value} onChange={(e) => setNewForm((f) => ({ ...f, value: e.target.value }))} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Probability (%)</label>
              <input type="number" min="0" max="100" value={newForm.probability} onChange={(e) => setNewForm((f) => ({ ...f, probability: e.target.value }))} placeholder="50" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Close Date</label>
              <input type="date" value={newForm.closeDate} onChange={(e) => setNewForm((f) => ({ ...f, closeDate: e.target.value }))} className={inputClass} />
            </div>
          </div>

          {/* Contact */}
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600">Contact</label>
            <input
              value={newContact ? `${newContact.firstName} ${newContact.lastName}` : newForm.contactSearch}
              onChange={(e) => { setNewForm((f) => ({ ...f, contactSearch: e.target.value })); setNewContact(null); doSearch('contact', e.target.value) }}
              placeholder="Search contacts…" className={inputClass}
            />
            {contactResults.length > 0 && !newContact && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {contactResults.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setNewContact(c); setContactResults([]) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {c.firstName} {c.lastName} {c.email && <span className="text-gray-400">· {c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Company */}
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
            <input
              value={newCompany ? newCompany.name : newForm.companySearch}
              onChange={(e) => { setNewForm((f) => ({ ...f, companySearch: e.target.value })); setNewCompany(null); doSearch('company', e.target.value) }}
              placeholder="Search companies…" className={inputClass}
            />
            {companyResults.length > 0 && !newCompany && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {companyResults.map((c: any) => (
                  <button key={c.id} type="button" onClick={() => { setNewCompany(c); setCompanyResults([]) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">{c.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <button type="button" onClick={() => setShowNewDeal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={creating} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
              {creating ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Outcome popups ─────────────────────────────────────────────── */}
      <Modal
        open={!!outcomeTarget}
        onClose={() => setOutcomeTarget(null)}
        title={outcomeTarget?.type === 'WON' ? 'Mark as Won' : outcomeTarget?.type === 'ABANDONED' ? 'Mark as Abandoned' : 'Mark as Lost'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {outcomeTarget?.type === 'WON' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Total Amount Won ($)</label>
              <input
                autoFocus
                type="number"
                value={wonAmount}
                onChange={(e) => setWonAmount(e.target.value)}
                placeholder="Enter deal value…"
                className={inputClass}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Reason {outcomeTarget?.type === 'ABANDONED' ? '(e.g. No Show, Not Interested)' : '(e.g. Price, Competitor)'}
              </label>
              <input
                autoFocus
                value={outcomeReason}
                onChange={(e) => setOutcomeReason(e.target.value)}
                placeholder="Enter reason…"
                className={inputClass}
                list={`reason-suggestions-${outcomeTarget?.type}`}
              />
              {reasonSuggestions.length > 0 && (
                <datalist id={`reason-suggestions-${outcomeTarget?.type}`}>
                  {reasonSuggestions.map((r) => <option key={r} value={r} />)}
                </datalist>
              )}
              {reasonSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {reasonSuggestions.slice(0, 5).map((r) => (
                    <button key={r} type="button" onClick={() => setOutcomeReason(r)}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <button onClick={() => setOutcomeTarget(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={submitOutcome} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B]">
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete confirm ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await removeFromPipeline(deleteId)
        }}
        title="Remove from Pipeline"
        description="This will permanently delete this deal from the pipeline."
        destructive
      />

      {/* ─── Pipeline Settings modal ────────────────────────────────────── */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Pipeline Settings" size="md">
        <div className="flex flex-col gap-4">
          {/* Pipeline name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Pipeline Name</label>
            <input
              autoFocus
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Stages editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Stages</label>
              <button
                type="button"
                onClick={() =>
                  setSettingsStages((prev) => [
                    ...prev,
                    { name: '', color: '#415A77', order: prev.length + 1 },
                  ])
                }
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Plus size={12} /> Add Stage
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {settingsStages.map((stage, i) => (
                <div key={stage.id ?? `new-${i}`} className="flex items-center gap-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => setSettingsStages((prev) => {
                        const next = [...prev]
                        ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                        return next
                      })}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={i === settingsStages.length - 1}
                      onClick={() => setSettingsStages((prev) => {
                        const next = [...prev]
                        ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                        return next
                      })}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) =>
                      setSettingsStages((prev) =>
                        prev.map((s, idx) => idx === i ? { ...s, color: e.target.value } : s)
                      )
                    }
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-200 p-0.5"
                    title="Stage color"
                  />
                  <input
                    value={stage.name}
                    onChange={(e) =>
                      setSettingsStages((prev) =>
                        prev.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s)
                      )
                    }
                    placeholder="Stage name…"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={settingsStages.length <= 1}
                    onClick={() => setSettingsStages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Remove stage"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => setConfirmDeletePipeline(true)}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete View
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={settingsSaving}
                className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
              >
                {settingsSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeletePipeline}
        onClose={() => setConfirmDeletePipeline(false)}
        onConfirm={deletePipeline}
        title="Delete Pipeline View"
        description={`Permanently delete "${settingsName}"? All deals in this pipeline will also be deleted.`}
        destructive
      />

      {/* Opportunity slide-over */}
      <OppSlideOver
        oppId={slideOverOppId as any}
        open={!!slideOverOppId}
        onClose={() => setSlideOverOppId(null)}
        stages={activePipeline?.stages ?? []}
        pipelineName={activePipeline?.name ?? ''}
        onStageChange={(id: string, stageId: string) =>
          setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, stageId } : o))
        }
        onDelete={(id: string) => {
          setOpportunities((prev) => prev.filter((o) => o.id !== id))
          setSlideOverOppId(null)
        }}
      />

      {/* Manage Pipelines slide-over */}
      <SlideOver open={showManage} onClose={() => { setShowManage(false); setRenamingId(null) }} title="Manage Pipelines" width={400}>
        <div className="flex flex-col gap-2 p-4">
          {pipelines.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={renamingValue}
                  onChange={(e) => setRenamingValue(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await fetch(`/api/pipelines/${p.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: renamingValue, stages: p.stages }),
                      })
                      setPipelines((prev) => prev.map((x) => x.id === p.id ? { ...x, name: renamingValue } : x))
                      setRenamingId(null)
                    }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onBlur={() => setRenamingId(null)}
                  className="flex-1 rounded-md border border-[#415A77] px-2 py-1 text-sm outline-none"
                />
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900">{p.name}</span>
                  <span className="text-xs text-gray-400">{p.stages.length} stages</span>
                  <button
                    onClick={() => { setRenamingId(p.id); setRenamingValue(p.name) }}
                    className="rounded p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${p.name}"? All deals will be lost.`)) return
                      await fetch(`/api/pipelines/${p.id}`, { method: 'DELETE' })
                      const remaining = pipelines.filter((x) => x.id !== p.id)
                      setPipelines(remaining)
                      if (activePipelineId === p.id) setActivePipelineId(remaining[0]?.id ?? '')
                    }}
                    className="rounded p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
          {pipelines.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No pipelines yet.</p>
          )}
        </div>
      </SlideOver>
    </div>
  )
}
