'use client'

import React, { useRef, useState, useCallback, type ElementType } from 'react'
import { CheckCircle2, X as XIcon, SkipForward } from 'lucide-react'
import type { AutomationDefinition, AutomationStep, StepLog, StepType } from '@/lib/automation-types'
import { STEP_BORDER_COLORS, STEP_LABELS, TRIGGER_LABELS, COPY_EDITABLE_TYPES } from '@/lib/automation-types'
import { cn } from '@/lib/utils'

// ─── Step result overlay ──────────────────────────────────────────────────────

function StepResult({ log }: { log: StepLog | undefined }) {
  if (!log) return null
  const map: Record<string, { bg: string; Icon: ElementType; iconColor: string }> = {
    success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', Icon: CheckCircle2, iconColor: '#27AE60' },
    skipped: { bg: 'bg-amber-50 border-amber-200 text-amber-700',       Icon: SkipForward,  iconColor: '#E67E22' },
    error:   { bg: 'bg-red-50 border-red-200 text-red-600',             Icon: XIcon,        iconColor: '#C0392B' },
  }
  const v = map[log.status]
  return (
    <div className={cn('mt-1.5 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px]', v.bg)}>
      <v.Icon size={12} className="mt-0.5 shrink-0" style={{color: v.iconColor}} />
      {log.detail}
    </div>
  )
}

// ─── Connector line ───────────────────────────────────────────────────────────

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center my-1 relative">
      <div className="w-px h-6 border-l-2 border-dashed border-[#415A77]/25 animate-[dash_1.5s_linear_infinite]" />
      <svg width="10" height="6" className="text-[#415A77]/30 -mt-0.5">
        <path d="M0 0 L5 6 L10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {label && (
        <span className="absolute -right-8 top-2 text-[9px] font-bold tracking-widest uppercase text-[#415A77]/50 bg-white px-1">
          {label}
        </span>
      )}
    </div>
  )
}

// ─── Trigger node ─────────────────────────────────────────────────────────────

function TriggerNode({ definition }: { definition: AutomationDefinition }) {
  const label = (TRIGGER_LABELS as Record<string, string>)[definition.trigger] ?? definition.trigger
  const cfg = definition.triggerConfig
  const entries = cfg ? Object.entries(cfg).filter(([, v]) => v != null) : []
  return (
    <div className="w-64 rounded-xl bg-[#0D1B2A] px-4 py-3.5 shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
          <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-[9px] font-bold tracking-widest text-blue-400/70 uppercase">Trigger</p>
          <p className="text-sm font-semibold text-white leading-tight">{label}</p>
        </div>
      </div>
      {entries.length > 0 && (
        <div className="mt-2 rounded-lg bg-white/5 px-2.5 py-1.5 space-y-0.5">
          {entries.map(([k, v]) => (
            <p key={k} className="text-xs text-gray-400">
              <span className="text-gray-500">{k}:</span> {String(v)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Condition node (global conditions) ──────────────────────────────────────

function ConditionNode({ condition }: { condition: Record<string, unknown> }) {
  return (
    <div className="relative flex items-center justify-center w-64 h-16">
      <div className="absolute inset-3 bg-amber-50 border-2 border-amber-300 shadow-sm rounded-lg rotate-45" />
      <div className="relative z-10 text-center px-8">
        <p className="text-[10px] font-semibold text-amber-900 leading-tight">
          {String(condition.field ?? '')} {String(condition.operator ?? '')}
          {condition.value != null ? ` "${condition.value}"` : ''}
        </p>
      </div>
    </div>
  )
}

// ─── Branch node ──────────────────────────────────────────────────────────────

function BranchNode({
  step,
  log,
  onNodeClick,
  logMap,
  stepMap,
  stepOrder,
  isTarget,
}: {
  step: AutomationStep
  log?: StepLog
  onNodeClick?: (step: AutomationStep) => void
  logMap: Map<string, StepLog>
  stepMap: Map<string, AutomationStep>
  stepOrder: string[]
  isTarget: boolean
}) {
  const cfg = step.config as { condition?: Record<string, unknown>; yes?: string; no?: string }
  const cond = cfg.condition as Record<string, unknown> | undefined

  return (
    <div className="flex flex-col items-center">
      {isTarget && (
        <div className="mb-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-bold text-amber-700 uppercase tracking-widest">
          ↑ Jump target: {step.id}
        </div>
      )}
      <div className="relative flex items-center justify-center w-64 h-20 cursor-default">
        <div className="absolute inset-2 bg-amber-50 border-2 border-amber-400 shadow-sm rounded-xl rotate-45" />
        <div className="relative z-10 text-center px-8">
          <p className="text-[9px] font-bold tracking-widest text-amber-700 uppercase">Branch</p>
          <p className="text-xs font-medium text-amber-900 leading-tight">{step.label}</p>
          {cond && (
            <p className="text-[10px] text-amber-700 mt-0.5">
              {String(cond.field ?? '')} {String(cond.operator ?? '')}
              {cond.value != null ? ` "${cond.value}"` : ''}
            </p>
          )}
        </div>
      </div>
      {log && <StepResult log={log} />}

      {/* Yes/No paths */}
      <div className="mt-2 flex gap-4 items-start w-full justify-center">
        {cfg.yes && (
          <div className="flex flex-col items-center">
            <Connector label="YES" />
            <JumpTarget targetId={cfg.yes} stepMap={stepMap} logMap={logMap} stepOrder={stepOrder} onNodeClick={onNodeClick} />
          </div>
        )}
        {cfg.no && (
          <div className="flex flex-col items-center">
            <Connector label="NO" />
            <JumpTarget targetId={cfg.no} stepMap={stepMap} logMap={logMap} stepOrder={stepOrder} onNodeClick={onNodeClick} />
          </div>
        )}
      </div>
    </div>
  )
}

// Renders a pointer to a BRANCH jump target (not full sub-graph, to avoid infinite recursion)
function JumpTarget({
  targetId,
  stepMap,
  logMap,
  stepOrder,
  onNodeClick,
}: {
  targetId: string
  stepMap: Map<string, AutomationStep>
  logMap: Map<string, StepLog>
  stepOrder: string[]
  onNodeClick?: (step: AutomationStep) => void
}) {
  const step = stepMap.get(targetId)
  if (!step) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500">
        Step "{targetId}" not found
      </div>
    )
  }
  // Show inline minicard for the target step
  return <ActionNode step={step} log={logMap.get(targetId)} onNodeClick={onNodeClick} isBranchTarget />
}

// ─── Action node ──────────────────────────────────────────────────────────────

const STEP_ICONS: Partial<Record<StepType, React.ReactNode>> = {
  EMAIL: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  SMS: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  WAIT: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  TASK: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  TAG: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  WEBHOOK: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
}

function getPreview(step: AutomationStep, copyOverrides?: Record<string, Record<string, string>>): string {
  const override = copyOverrides?.[step.id]
  const cfg = override ? { ...step.config, ...override } : step.config
  const c = cfg as Record<string, unknown>

  switch (step.type) {
    case 'EMAIL': return String(c.subject ?? '')
    case 'SMS': return String(c.body ?? '').slice(0, 60)
    case 'WAIT': return `${c.duration ?? 1} ${c.unit ?? 'days'}`
    case 'TASK': return String(c.title ?? '')
    case 'TAG': {
      return `${c.action === 'remove' ? 'Remove' : 'Add'} #${c.tag ?? ''}`
    }
    case 'STAGE_MOVE': return `→ ${c.stageName ?? ''}`
    case 'WEBHOOK': return String(c.url ?? '')
    default: return ''
  }
}

function ActionNode({
  step,
  log,
  onNodeClick,
  isBranchTarget,
  copyOverrides,
}: {
  step: AutomationStep
  log?: StepLog
  onNodeClick?: (step: AutomationStep) => void
  isBranchTarget?: boolean
  copyOverrides?: Record<string, Record<string, string>>
}) {
  const color = (STEP_BORDER_COLORS as Record<string, string>)[step.type] ?? '#9CA3AF'
  const label = (STEP_LABELS as Record<string, string>)[step.type] ?? step.type
  const icon = STEP_ICONS[step.type]
  const isEditable = COPY_EDITABLE_TYPES.includes(step.type as typeof COPY_EDITABLE_TYPES[number])
  const preview = getPreview(step, copyOverrides)
  const hasOverride = Boolean(copyOverrides?.[step.id])

  return (
    <div className={cn('w-64', isBranchTarget && 'opacity-90')}>
      <div
        className={cn(
          'rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden transition-all',
          isEditable && 'cursor-pointer hover:shadow-md hover:border-gray-200',
          isBranchTarget && 'border-dashed'
        )}
        style={{ borderLeft: `4px solid ${color}` }}
        onClick={() => isEditable && onNodeClick?.(step)}
      >
        <div className="px-3.5 py-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span style={{ color }}>{icon}</span>
              <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color }}>
                {label}
              </p>
              {hasOverride && (
                <span className="text-[9px] text-[#415A77]/60 font-medium">(edited)</span>
              )}
            </div>
            {isEditable && (
              <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
          </div>
          <p className="text-xs font-medium text-gray-800 leading-snug">{step.label}</p>
          {preview && (
            <p className="mt-0.5 text-[11px] text-gray-500 truncate" title={preview}>{preview}</p>
          )}
        </div>
      </div>
      <StepResult log={log} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FlowDiagramProps {
  definition: AutomationDefinition
  stepLogs?: StepLog[]
  copyOverrides?: Record<string, Record<string, string>>
  onNodeClick?: (step: AutomationStep) => void
  compact?: boolean
}

export function FlowDiagram({ definition, stepLogs, copyOverrides, onNodeClick, compact }: FlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
    e.preventDefault()
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setTransform((t) => ({ ...t, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy }))
  }, [])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => ({ ...t, scale: Math.min(2, Math.max(0.3, t.scale * delta)) }))
  }, [])

  const logMap = new Map<string, StepLog>()
  stepLogs?.forEach((l) => logMap.set(l.stepId, l))

  const stepMap = new Map<string, AutomationStep>()
  const stepOrder: string[] = []
  for (const step of definition.steps) {
    stepMap.set(step.id, step)
    stepOrder.push(step.id)
  }

  // Find steps that are BRANCH targets (jumped to, not sequential)
  const branchTargets = new Set<string>()
  for (const step of definition.steps) {
    if (step.type === 'BRANCH') {
      const cfg = step.config as { yes?: string; no?: string }
      if (cfg.yes) branchTargets.add(cfg.yes)
      if (cfg.no) branchTargets.add(cfg.no)
    }
  }

  const fitToScreen = () => setTransform({ x: 0, y: 0, scale: 1 })
  const zoom = (d: number) => setTransform((t) => ({ ...t, scale: Math.min(2, Math.max(0.3, t.scale * d)) }))

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden select-none bg-[#FAFAFA]',
        compact ? 'h-80' : 'h-full min-h-[500px]'
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          backgroundPosition: `${transform.x % 28}px ${transform.y % 28}px`,
          opacity: 0.4,
        }}
      />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button
          onClick={() => zoom(1.2)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold"
        >+</button>
        <button
          onClick={() => zoom(0.8)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold"
        >−</button>
        <button
          onClick={fitToScreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
          title="Fit to screen"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Transform layer */}
      <div
        data-node
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'top center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: compact ? '24px 32px' : '40px 80px',
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {/* Trigger */}
        <TriggerNode definition={definition} />

        {/* Global conditions */}
        {(definition.conditions ?? []).map((cond, i) => (
          <React.Fragment key={i}>
            <Connector />
            <ConditionNode condition={cond as Record<string, unknown>} />
          </React.Fragment>
        ))}

        {/* Steps — render in array order, skip BRANCH targets in main flow */}
        {definition.steps.map((step, i) => {
          const isBranchTarget = branchTargets.has(step.id)
          // BRANCH targets are rendered inline within the branch, not in main sequence
          // Unless they also appear sequentially right after a non-branch step
          // To avoid double-rendering, we skip them in the main flow
          if (isBranchTarget) return null

          const isLast = (() => {
            for (let j = i + 1; j < definition.steps.length; j++) {
              if (!branchTargets.has(definition.steps[j].id)) return false
            }
            return true
          })()

          return (
            <React.Fragment key={step.id}>
              <Connector />
              {step.type === 'BRANCH' ? (
                <BranchNode
                  step={step}
                  log={logMap.get(step.id)}
                  onNodeClick={onNodeClick}
                  logMap={logMap}
                  stepMap={stepMap}
                  stepOrder={stepOrder}
                  isTarget={false}
                />
              ) : (
                <ActionNode
                  step={step}
                  log={logMap.get(step.id)}
                  onNodeClick={onNodeClick}
                  copyOverrides={copyOverrides}
                />
              )}
              {isLast && i < definition.steps.length - 1 && <div className="h-4" />}
            </React.Fragment>
          )
        })}

        {definition.steps.length === 0 && (
          <>
            <Connector />
            <p className="text-xs text-gray-400 italic">No steps defined</p>
          </>
        )}
      </div>
    </div>
  )
}
