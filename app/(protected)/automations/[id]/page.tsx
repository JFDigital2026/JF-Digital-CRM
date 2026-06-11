'use client'

export const dynamic = 'force-dynamic'

import nextDynamic from 'next/dynamic'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { CopyEditorSlideOver } from '@/components/automations/copy-editor-slideover'

const FlowDiagram = nextDynamic(
  () => import('@/components/automations/flow-diagram').then((m) => ({ default: m.FlowDiagram })),
  {
    loading: () => <div className="flex-1 animate-pulse rounded-xl bg-gray-100" />,
    ssr: false,
  }
)
import { TestRunnerModal } from '@/components/automations/test-runner-modal'
import { TRIGGER_LABELS, type AutomationDefinition, type AutomationStep } from '@/lib/automation-types'
import { cn } from '@/lib/utils'

type AutomationFull = {
  id: string
  name: string
  description: string | null
  sourceFile: string | null
  trigger: string
  triggerConfig: unknown
  conditions: unknown
  steps: unknown[]
  copyOverrides: unknown
  active: boolean
  syncStatus: string
  lastSyncedAt: string | null
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-[#0D1B2A]' : 'bg-gray-200', disabled && 'opacity-50')}
    >
      <span className={cn('pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

function AutomationDetailPageInner() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params.id

  const [automation, setAutomation] = useState<AutomationFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [editStep, setEditStep] = useState<AutomationStep | null>(null)
  const [showTest, setShowTest] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/automations/${id}`)
      if (!res.ok) { router.push('/automations'); return }
      setAutomation(await res.json())
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  // Auto-open test runner if ?test=1
  useEffect(() => {
    if (searchParams.get('test') === '1' && automation) {
      setShowTest(true)
    }
  }, [searchParams, automation])

  const handleToggle = async (active: boolean) => {
    if (!automation) return
    setToggling(true)
    setAutomation((a) => a ? { ...a, active } : a)
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setToggling(false)
  }

  const handleCopySaved = (stepId: string, fields: Record<string, string>) => {
    setAutomation((prev) => {
      if (!prev) return prev
      const existing = (prev.copyOverrides as Record<string, Record<string, string>>) ?? {}
      return {
        ...prev,
        copyOverrides: { ...existing, [stepId]: { ...(existing[stepId] ?? {}), ...fields } },
      }
    })
  }

  const definition: AutomationDefinition | null = automation
    ? {
        name: automation.name,
        description: automation.description ?? undefined,
        trigger: automation.trigger as AutomationDefinition['trigger'],
        triggerConfig: (automation.triggerConfig as Record<string, unknown>) ?? {},
        conditions: (automation.conditions as AutomationDefinition['conditions']) ?? [],
        steps: automation.steps as AutomationDefinition['steps'],
      }
    : null

  const copyOverrides = (automation?.copyOverrides as Record<string, Record<string, string>>) ?? {}

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto animate-pulse space-y-4">
        <div className="h-5 bg-gray-100 rounded w-1/4" />
        <div className="h-7 bg-gray-100 rounded w-1/3" />
        <div className="h-[500px] bg-gray-100 rounded-2xl mt-6" />
      </div>
    )
  }

  if (!automation || !definition) return null

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/automations')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-4 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Automations
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">{automation.name}</h1>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', TRIGGER_COLORS[automation.trigger] ?? 'bg-gray-100 text-gray-600')}>
              {(TRIGGER_LABELS as Record<string, string>)[automation.trigger] ?? automation.trigger}
            </span>
            {automation.sourceFile && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-500">
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                /automations/{automation.sourceFile}
              </span>
            )}
          </div>
          {automation.description && <p className="text-sm text-gray-500">{automation.description}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Last run: {automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString() : 'Never'}
            {' · '}
            {automation.steps.length} step{automation.steps.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{automation.active ? 'Active' : 'Inactive'}</span>
            <Toggle checked={automation.active} onChange={handleToggle} disabled={toggling} />
          </div>
          <button
            onClick={() => setShowTest(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#415A77]/20 bg-white px-4 py-2 text-sm font-medium text-[#415A77] hover:bg-[#415A77]/5 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Test
          </button>
          <button
            onClick={() => router.push(`/automations/${id}/logs`)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Logs
          </button>
        </div>
      </div>

      {/* Claude Code note */}
      <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#0D1B2A]/3 border border-[#415A77]/10 px-4 py-3">
        <svg className="h-4 w-4 text-[#415A77] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <p className="text-xs text-gray-600">
          To edit this automation&apos;s structure, open{' '}
          <code className="font-mono bg-white border border-gray-200 rounded px-1">
            /automations/{automation.sourceFile ?? '[filename].json'}
          </code>{' '}
          in your Claude Code project.{' '}
          <span className="text-[#415A77] font-medium">Click any EMAIL, SMS, or TASK node to edit copy.</span>
        </p>
      </div>

      {/* Flow diagram */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden" style={{ height: 580 }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Flow</p>
          <p className="text-xs text-gray-400">Click EMAIL, SMS, or TASK nodes to edit copy</p>
        </div>
        <FlowDiagram
          definition={definition}
          copyOverrides={copyOverrides}
          onNodeClick={(step) => setEditStep(step)}
        />
      </div>

      {/* Copy editor slide-over */}
      {editStep && (
        <CopyEditorSlideOver
          step={editStep}
          automationId={id}
          overrides={copyOverrides[editStep.id]}
          onClose={() => setEditStep(null)}
          onSaved={(stepId, fields) => {
            handleCopySaved(stepId, fields)
            setEditStep(null)
          }}
        />
      )}

      {/* Test runner modal */}
      {showTest && (
        <TestRunnerModal
          automationId={id}
          definition={definition}
          onClose={() => setShowTest(false)}
        />
      )}
    </div>
  )
}

export default function AutomationDetailPage() {
  return (
    <Suspense fallback={null}>
      <AutomationDetailPageInner />
    </Suspense>
  )
}
