'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, LayoutList, Columns, CheckCircle2, X as XIcon } from 'lucide-react'
import { format, isToday, isPast, startOfDay, isYesterday } from 'date-fns'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { PageHeader } from '@/components/ui/page-header'
import { TabGroup } from '@/components/ui/tab-group'
import { ActionMenu } from '@/components/ui/action-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ContactSlideOver } from '@/components/contacts/contact-slide-over'
import { TaskSlideOver } from '@/components/tasks/task-slide-over'
import { TaskTemplatesPanel } from '@/components/tasks/task-templates-panel'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

interface Task {
  id: string
  title: string
  description?: string | null
  dueDate?: string | null
  status: TaskStatus
  priority: TaskPriority
  contactId?: string | null
  companyId?: string | null
  assignedTo?: string | null
  isRecurring: boolean
  recurrenceRule?: string | null
  createdAt: string
  contact?: { id: string; firstName: string; lastName: string } | null
  company?: { id: string; name: string } | null
  assignee?: { id: string; name: string | null } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'My Tasks' },
  { key: 'today', label: 'Due Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
]

const KANBAN_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
]

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: 'bg-green-50 text-green-700 border-green-200',
  MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Done',
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

// ─── Priority Picker ─────────────────────────────────────────────────────────

const PRIORITY_GRADIENT: Record<TaskPriority, string> = {
  LOW:    'linear-gradient(to right, rgba(34,197,94,0.13) 0%, transparent 100%)',
  MEDIUM: 'linear-gradient(to right, rgba(234,179,8,0.15) 0%, transparent 100%)',
  HIGH:   'linear-gradient(to right, rgba(239,68,68,0.15) 0%, transparent 100%)',
}

const PRIORITY_TINT: Record<TaskPriority, string> = {
  LOW:    'rgba(34,197,94,0.13)',
  MEDIUM: 'rgba(234,179,8,0.15)',
  HIGH:   'rgba(239,68,68,0.15)',
}

function PriorityPicker({
  priority,
  onChange,
}: {
  priority: TaskPriority
  onChange: (p: TaskPriority) => void
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const inBtn  = btnRef.current?.contains(e.target as Node)
      const inDrop = dropRef.current?.contains(e.target as Node)
      if (!inBtn && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setCoords({ top: rect.bottom + 4, left: rect.left })
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          'rounded-full border px-2 py-0.5 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity',
          PRIORITY_STYLES[priority]
        )}
      >
        {PRIORITY_LABELS[priority]}
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
          className="bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden min-w-[100px]"
        >
          {(['LOW', 'MEDIUM', 'HIGH'] as TaskPriority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left hover:bg-gray-50 transition-colors',
                p === priority && 'bg-gray-50'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', {
                'bg-green-500': p === 'LOW',
                'bg-yellow-400': p === 'MEDIUM',
                'bg-red-500': p === 'HIGH',
              })} />
              {PRIORITY_LABELS[p]}
              {p === priority && <CheckCircle2 size={13} className="ml-auto" style={{color:'#415A77'}} />}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDueDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'COMPLETED') return false
  return isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))
}

function isDueToday(task: Task): boolean {
  if (!task.dueDate || task.status === 'COMPLETED') return false
  return isToday(new Date(task.dueDate))
}

// ─── Kanban Sortable Card ─────────────────────────────────────────────────────

function SortableTaskCard({
  task,
  onEdit,
  onDelete,
  onPriorityChange,
}: {
  task: Task
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onPriorityChange: (id: string, p: TaskPriority) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none relative overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ background: PRIORITY_GRADIENT[task.priority] }}
      />
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p
          className={cn(
            'text-sm font-medium text-gray-900 leading-snug',
            task.status === 'COMPLETED' && 'line-through text-gray-400'
          )}
        >
          {task.title}
        </p>
        <div
          className="shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionMenu
            items={[
              { label: 'Edit', onClick: () => onEdit(task) },
              { label: 'Delete', onClick: () => onDelete(task.id), danger: true, separator: true },
            ]}
          />
        </div>
      </div>

      {task.contact && (
        <span className="inline-block text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 mb-1">
          {task.contact.firstName} {task.contact.lastName}
        </span>
      )}

      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {task.dueDate && (
          <p
            className={cn(
              'text-xs',
              isOverdue(task) ? 'text-red-500 font-medium' : isDueToday(task) ? 'text-yellow-600 font-medium' : 'text-gray-400'
            )}
          >
            {formatDueDate(task.dueDate)}
          </p>
        )}
        <div onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <PriorityPicker
            priority={task.priority}
            onChange={(p) => onPriorityChange(task.id, p)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [view, setView] = useState<'table' | 'kanban'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tasks-default-view') as 'table' | 'kanban') ?? 'table'
    }
    return 'table'
  })
  const [filter, setFilter] = useState('all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showSlideOver, setShowSlideOver] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [activeKanbanId, setActiveKanbanId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ filter })
    const res = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(data.tasks ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Persist view choice
  useEffect(() => {
    localStorage.setItem('tasks-default-view', view)
  }, [view])

  // ─── Table actions ────────────────────────────────────────────────────────

  const completeTask = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    fetchTasks()
  }, [fetchTasks])

  const patchPriority = useCallback(async (id: string, priority: TaskPriority) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority } : t))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    })
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    fetchTasks()
  }, [fetchTasks])

  const handleBulkComplete = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
        })
      )
    )
    setSelectedIds(new Set())
    fetchTasks()
  }, [selectedIds, fetchTasks])

  const handleBulkDelete = useCallback(async () => {
    await Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' })))
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
    fetchTasks()
  }, [selectedIds, fetchTasks])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)))
    }
  }

  // ─── Kanban DnD ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveKanbanId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveKanbanId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      // Determine target column: over.id can be a task id or a column key
      const columnKeys: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'COMPLETED']
      let targetStatus: TaskStatus | null = null

      if (columnKeys.includes(over.id as TaskStatus)) {
        targetStatus = over.id as TaskStatus
      } else {
        // over.id is another task — find which column it belongs to
        const overTask = tasks.find((t) => t.id === over.id)
        if (overTask) targetStatus = overTask.status
      }

      if (!targetStatus) return

      const activeTask = tasks.find((t) => t.id === active.id)
      if (!activeTask || activeTask.status === targetStatus) return

      // Optimistically update
      setTasks((prev) =>
        prev.map((t) => (t.id === active.id ? { ...t, status: targetStatus! } : t))
      )

      await fetch(`/api/tasks/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
    },
    [tasks]
  )

  const activeKanbanTask = tasks.find((t) => t.id === activeKanbanId) ?? null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-6">
      <PageHeader
        title="Tasks"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setView('table')}
                title="Table view"
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center',
                  view === 'table' ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <LayoutList size={14} />
              </button>
              <button
                onClick={() => setView('kanban')}
                title="Kanban view"
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center border-l border-gray-200',
                  view === 'kanban' ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <Columns size={14} />
              </button>
            </div>

            <button
              onClick={() => setShowTemplates(true)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Templates
            </button>

            <button
              onClick={() => { setEditingTask(null); setShowSlideOver(true) }}
              className="bg-[#0D1B2A] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1B263B] flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              New Task
            </button>
          </div>
        }
      />

      {/* Filter tabs */}
      <TabGroup
        tabs={FILTER_TABS}
        active={filter}
        onChange={(k) => { setFilter(k); setSelectedIds(new Set()) }}
        className="mb-4"
      />

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-[#0D1B2A] text-white rounded-lg text-sm w-fit">
          <span className="font-medium">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkComplete}
            className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            <CheckCircle2 size={13} /> Complete
          </button>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="text-red-300 hover:text-red-200 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-white ml-1 transition-colors"
          >
            <XIcon size={13} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSkeleton variant="table" rows={6} columns={8} />}

      {/* Empty */}
      {!loading && tasks.length === 0 && (
        <EmptyState
          title="No tasks found"
          description="Create a task to get started."
          action={
            <button
              onClick={() => { setEditingTask(null); setShowSlideOver(true) }}
              className="bg-[#0D1B2A] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1B263B] flex items-center gap-1.5"
            >
              <Plus size={14} /> New Task
            </button>
          }
        />
      )}

      {/* TABLE VIEW */}
      {!loading && tasks.length > 0 && view === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === tasks.length && tasks.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 accent-[#0D1B2A]"
                  />
                </th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Due Date</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Assignee</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const overdue = isOverdue(task)
                const today = isDueToday(task)
                const completed = task.status === 'COMPLETED'
                return (
                  <tr
                    key={task.id}
                    onClick={() => { setEditingTask(task); setShowSlideOver(true) }}
                    className={cn(
                      'border-b border-gray-50 transition-colors hover:bg-gray-50/50 cursor-pointer',
                      overdue && 'border-l-4 border-l-red-400',
                      today && !overdue && 'border-l-4 border-l-yellow-400',
                      completed && 'opacity-60'
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: PRIORITY_TINT[task.priority] }}
                      />
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-[#0D1B2A] relative"
                      />
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3 max-w-[220px] relative">
                      <div
                        className="absolute inset-0 pointer-events-none rounded-l"
                        style={{ background: PRIORITY_GRADIENT[task.priority] }}
                      />
                      <p
                        className={cn(
                          'font-medium text-gray-900 truncate relative',
                          completed && 'line-through text-gray-400'
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5 relative">{task.description}</p>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {task.contact ? (
                        <button
                          onClick={() => setSelectedContactId(task.contact!.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          {task.contact.firstName} {task.contact.lastName}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      {task.company ? (
                        <span className="text-gray-700 text-xs">{task.company.name}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-3">
                      {task.dueDate ? (
                        <span
                          className={cn(
                            'text-sm',
                            overdue ? 'text-red-500 font-semibold' : today ? 'text-yellow-600 font-semibold' : 'text-gray-500'
                          )}
                        >
                          {formatDueDate(task.dueDate)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <PriorityPicker
                        priority={task.priority}
                        onChange={(p) => patchPriority(task.id, p)}
                      />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          STATUS_STYLES[task.status]
                        )}
                      >
                        {STATUS_LABELS[task.status]}
                      </span>
                    </td>

                    {/* Assignee */}
                    <td className="px-4 py-3">
                      {task.assignee ? (
                        <span className="text-xs text-gray-600">{task.assignee.name ?? '—'}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: 'Edit',
                            onClick: () => { setEditingTask(task); setShowSlideOver(true) },
                          },
                          {
                            label: 'Mark Complete',
                            onClick: () => completeTask(task.id),
                          },
                          {
                            label: 'Delete',
                            onClick: () => setConfirmDelete(task.id),
                            danger: true,
                            separator: true,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* KANBAN VIEW */}
      {!loading && view === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key)
              return (
                <KanbanColumn
                  key={col.key}
                  column={col}
                  tasks={colTasks}
                  onEdit={(t) => { setEditingTask(t); setShowSlideOver(true) }}
                  onDelete={(id) => setConfirmDelete(id)}
                  onAddTask={() => { setEditingTask(null); setShowSlideOver(true) }}
                  onPriorityChange={patchPriority}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeKanbanTask && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xl cursor-grabbing opacity-90 w-[280px]">
                <p className="text-sm font-medium text-gray-900">{activeKanbanTask.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals & Panels */}
      <TaskSlideOver
        open={showSlideOver}
        onClose={() => { setShowSlideOver(false); setEditingTask(null) }}
        onSuccess={() => fetchTasks()}
        initialTask={editingTask as Record<string, unknown> | null}
      />

      <TaskTemplatesPanel
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
      />

      {selectedContactId && (
        <ContactSlideOver
          contactId={selectedContactId}
          onClose={() => setSelectedContactId(null)}
          onEdit={() => {}}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteTask(confirmDelete)}
        title="Delete Task"
        description="This task will be permanently deleted. This action cannot be undone."
        destructive
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} Tasks`}
        description="These tasks will be permanently deleted. This action cannot be undone."
        destructive
        confirmLabel="Delete All"
      />
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  onEdit,
  onDelete,
  onAddTask,
  onPriorityChange,
}: {
  column: { key: TaskStatus; label: string }
  tasks: Task[]
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onAddTask: () => void
  onPriorityChange: (id: string, p: TaskPriority) => void
}) {
  const { setNodeRef, isOver } = useSortable({
    id: column.key,
    data: { type: 'column', status: column.key },
  })

  const COLUMN_COLORS: Record<TaskStatus, string> = {
    TODO: 'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border border-gray-200 bg-gray-50/80 p-3 min-w-[280px] w-[280px] transition-colors',
        isOver && 'border-[#415A77] bg-blue-50/40'
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{column.label}</h3>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-bold',
            COLUMN_COLORS[column.key]
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onPriorityChange={onPriorityChange}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-6">
              <p className="text-xs text-gray-400">No tasks</p>
            </div>
          )}
        </div>
      </SortableContext>

      {/* Add task button */}
      <button
        onClick={onAddTask}
        className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-2 text-xs font-medium text-gray-500 hover:bg-white hover:border-gray-300 transition-colors"
      >
        <Plus size={12} /> Add Task
      </button>
    </div>
  )
}
