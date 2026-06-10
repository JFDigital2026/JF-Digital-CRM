'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

interface TemplateTaskDef {
  title: string
  description: string
  relativeDueDays: number
  priority: TaskPriority
}

interface TaskTemplate {
  id: string
  name: string
  tasks: TemplateTaskDef[]
  createdAt: string
  _count?: { linkedTasks: number }
}

interface TaskTemplatesPanelProps {
  open: boolean
  onClose: () => void
}

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20 transition-colors'

const labelClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH']

function emptyTaskDef(): TemplateTaskDef {
  return { title: '', description: '', relativeDueDays: 0, priority: 'MEDIUM' }
}

export function TaskTemplatesPanel({ open, onClose }: TaskTemplatesPanelProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editTasks, setEditTasks] = useState<TemplateTaskDef[]>([emptyTaskDef()])

  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/task-templates')
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (open) fetchTemplates()
  }, [open, fetchTemplates])

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null

  const startEdit = (tpl: TaskTemplate) => {
    setIsCreating(false)
    setSelectedId(tpl.id)
    setEditName(tpl.name)
    setEditTasks(
      tpl.tasks?.length
        ? tpl.tasks.map((t) => ({
            title: t.title ?? '',
            description: t.description ?? '',
            relativeDueDays: t.relativeDueDays ?? 0,
            priority: t.priority ?? 'MEDIUM',
          }))
        : [emptyTaskDef()]
    )
  }

  const startCreate = () => {
    setIsCreating(true)
    setSelectedId(null)
    setEditName('')
    setEditTasks([emptyTaskDef()])
  }

  const handleSave = async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      if (isCreating) {
        const res = await fetch('/api/task-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim(), tasks: editTasks }),
        })
        const created: TaskTemplate = await res.json()
        await fetchTemplates()
        setIsCreating(false)
        setSelectedId(created.id)
      } else if (selectedId) {
        await fetch(`/api/task-templates/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim(), tasks: editTasks }),
        })
        await fetchTemplates()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setDeleting(true)
    try {
      await fetch(`/api/task-templates/${selectedId}`, { method: 'DELETE' })
      setSelectedId(null)
      setIsCreating(false)
      await fetchTemplates()
    } finally {
      setDeleting(false)
    }
  }

  const updateTask = (index: number, field: keyof TemplateTaskDef, value: string | number) => {
    setEditTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  const removeTask = (index: number) => {
    setEditTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const addTask = () => {
    setEditTasks((prev) => [...prev, emptyTaskDef()])
  }

  if (!open) return null

  const showRightPanel = isCreating || selectedTemplate !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Task Templates</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: template list */}
          <div className="w-[260px] border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-3 border-b border-gray-100">
              <button
                onClick={startCreate}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isCreating
                    ? 'bg-[#0D1B2A] text-white'
                    : 'border border-dashed border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <Plus size={14} />
                New Template
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {templates.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-400 text-center">No templates yet</p>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => startEdit(tpl)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-gray-50 transition-colors',
                      selectedId === tpl.id && !isCreating
                        ? 'bg-[#0D1B2A]/5 border-l-2 border-l-[#0D1B2A]'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{tpl.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Array.isArray(tpl.tasks) ? tpl.tasks.length : 0} task
                      {Array.isArray(tpl.tasks) && tpl.tasks.length !== 1 ? 's' : ''}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: edit/create form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {showRightPanel ? (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                  {/* Template name */}
                  <div>
                    <label className={labelClass}>Template Name</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Onboarding Sequence"
                      className={inputClass}
                    />
                  </div>

                  {/* Task list */}
                  <div>
                    <label className={labelClass}>Tasks</label>
                    <div className="flex flex-col gap-3">
                      {editTasks.map((task, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-gray-200 p-3 flex flex-col gap-2 bg-gray-50/50"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400 w-4">{idx + 1}.</span>
                            <input
                              value={task.title}
                              onChange={(e) => updateTask(idx, 'title', e.target.value)}
                              placeholder="Task title"
                              className={cn(inputClass, 'flex-1')}
                            />
                            <button
                              type="button"
                              onClick={() => removeTask(idx)}
                              className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="flex gap-2 pl-6">
                            <input
                              type="number"
                              min={0}
                              value={task.relativeDueDays}
                              onChange={(e) => updateTask(idx, 'relativeDueDays', parseInt(e.target.value) || 0)}
                              className={cn(inputClass, 'w-24')}
                              title="Days from start date"
                              placeholder="Days"
                            />
                            <select
                              value={task.priority}
                              onChange={(e) => updateTask(idx, 'priority', e.target.value)}
                              className={cn(inputClass, 'flex-1')}
                            >
                              {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>
                                  {p.charAt(0) + p.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addTask}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <Plus size={13} /> Add Task
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200">
                  {!isCreating && selectedId ? (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsCreating(false); setSelectedId(null) }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !editName.trim()}
                      className="rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving…' : isCreating ? 'Create Template' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                Select a template or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
