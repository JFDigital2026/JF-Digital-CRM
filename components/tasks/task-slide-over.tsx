'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { SlideOver } from '@/components/ui/slide-over'
import { cn } from '@/lib/utils'
import { addDays, addMonths, addWeeks, format } from 'date-fns'
import { useSession } from 'next-auth/react'

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'

interface User {
  id: string
  name: string | null
  email: string
}

interface ContactResult {
  id: string
  firstName: string
  lastName: string
  email?: string | null
}

interface CompanyResult {
  id: string
  name: string
}

interface TemplateTask {
  title: string
  description?: string
  relativeDueDays?: number
  priority?: TaskPriority
}

interface Template {
  id: string
  name: string
  tasks: TemplateTask[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask = Record<string, any>

export interface TaskSlideOverProps {
  open: boolean
  onClose: () => void
  onSuccess: (task: unknown) => void
  initialTask?: AnyTask | null
  initialContact?: { id: string; firstName: string; lastName: string } | null
  initialCompany?: { id: string; name: string } | null
}

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20 transition-colors'

const labelClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-[#0D1B2A] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function nextOccurrenceDate(dueDate: string, rule: string): string {
  if (!dueDate) return ''
  const d = new Date(dueDate)
  let next: Date
  if (rule === 'DAILY') next = addDays(d, 1)
  else if (rule === 'WEEKLY') next = addWeeks(d, 1)
  else next = addMonths(d, 1)
  return format(next, 'MMM d, yyyy')
}

export function TaskSlideOver({
  open,
  onClose,
  onSuccess,
  initialTask,
  initialContact,
  initialCompany,
}: TaskSlideOverProps) {
  const { data: session } = useSession()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [assignedTo, setAssignedTo] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState('WEEKLY')
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState<User[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  // Contact typeahead
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<ContactResult[]>([])
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null)

  // Company typeahead
  const [companySearch, setCompanySearch] = useState('')
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([])
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null)

  const contactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const companyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isEdit = !!initialTask?.id

  // Populate from initialTask when editing
  useEffect(() => {
    if (!open) return
    if (initialTask) {
      setTitle((initialTask.title as string) ?? '')
      setDescription((initialTask.description as string) ?? '')
      if (initialTask.dueDate) {
        // Convert ISO string to datetime-local format
        const d = new Date(initialTask.dueDate as string)
        const pad = (n: number) => String(n).padStart(2, '0')
        setDueDate(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        )
      } else {
        setDueDate('')
      }
      setPriority((initialTask.priority as TaskPriority) ?? 'MEDIUM')
      setStatus((initialTask.status as TaskStatus) ?? 'TODO')
      setAssignedTo((initialTask.assignedTo as string) ?? '')
      setIsRecurring((initialTask.isRecurring as boolean) ?? false)
      setRecurrenceRule((initialTask.recurrenceRule as string) ?? 'WEEKLY')
      if (initialTask.contact) {
        setSelectedContact(initialTask.contact as ContactResult)
      } else if (initialContact) {
        setSelectedContact(initialContact)
      } else {
        setSelectedContact(null)
      }
      if (initialTask.company) {
        setSelectedCompany(initialTask.company as CompanyResult)
      } else if (initialCompany) {
        setSelectedCompany(initialCompany)
      } else {
        setSelectedCompany(null)
      }
    } else {
      // Creating new
      setTitle('')
      setDescription('')
      setDueDate('')
      setPriority('MEDIUM')
      setStatus('TODO')
      setIsRecurring(false)
      setRecurrenceRule('WEEKLY')
      setSelectedContact(initialContact ?? null)
      setSelectedCompany(initialCompany ?? null)
    }
    setContactSearch('')
    setContactResults([])
    setCompanySearch('')
    setCompanyResults([])
  }, [open, initialTask, initialContact, initialCompany])

  // Load users and templates once
  useEffect(() => {
    if (!open) return
    fetch('/api/users')
      .then((r) => r.json())
      .then((data: User[]) => {
        setUsers(data)
        // Set default assignee: current user or first user
        if (!isEdit || !initialTask?.assignedTo) {
          const currentUser = session?.user?.id
            ? data.find((u) => u.id === session.user.id)
            : null
          setAssignedTo(currentUser?.id ?? data[0]?.id ?? '')
        }
      })
      .catch(() => {})

    fetch('/api/task-templates')
      .then((r) => r.json())
      .then((data: Template[]) => setTemplates(data))
      .catch(() => {})
  }, [open, isEdit, initialTask, session?.user?.id])

  const searchContacts = useCallback((q: string) => {
    if (contactTimer.current) clearTimeout(contactTimer.current)
    if (!q.trim()) { setContactResults([]); return }
    contactTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=5`)
      const data = await res.json()
      setContactResults(data.contacts ?? [])
    }, 250)
  }, [])

  const searchCompanies = useCallback((q: string) => {
    if (companyTimer.current) clearTimeout(companyTimer.current)
    if (!q.trim()) { setCompanyResults([]); return }
    companyTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/companies?search=${encodeURIComponent(q)}`)
      const data = await res.json()
      setCompanyResults(Array.isArray(data) ? data : data.companies ?? [])
    }, 250)
  }, [])

  const loadTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl || !tpl.tasks?.length) return
    const first = tpl.tasks[0]
    setTitle(first.title ?? '')
    setDescription(first.description ?? '')
    setPriority(first.priority ?? 'MEDIUM')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    const payload = {
      title: title.trim(),
      description: description || null,
      dueDate: dueDate || null,
      priority,
      status,
      assignedTo: assignedTo || null,
      contactId: selectedContact?.id ?? null,
      companyId: selectedCompany?.id ?? null,
      isRecurring,
      recurrenceRule: isRecurring ? recurrenceRule : null,
    }

    try {
      const url = isEdit ? `/api/tasks/${initialTask!.id}` : '/api/tasks'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const task = await res.json()
      onSuccess(task)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const saveButton = (
    <button
      form="task-slide-over-form"
      type="submit"
      disabled={saving || !title.trim()}
      className="rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
    >
      {saving ? 'Saving…' : 'Save'}
    </button>
  )

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'New Task'}
      width={480}
      headerAction={saveButton}
    >
      <form
        id="task-slide-over-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 px-5 py-4 overflow-y-auto flex-1"
      >
        {/* Title */}
        <div>
          <label className={labelClass}>Title <span className="text-red-400 normal-case font-normal">*</span></label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title…"
            required
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional notes…"
            className={cn(inputClass, 'resize-none')}
          />
        </div>

        {/* Due Date */}
        <div>
          <label className={labelClass}>Due Date</label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Priority */}
        <div>
          <label className={labelClass}>Priority</label>
          <SegmentedControl<TaskPriority>
            options={[
              { label: 'Low', value: 'LOW' },
              { label: 'Medium', value: 'MEDIUM' },
              { label: 'High', value: 'HIGH' },
            ]}
            value={priority}
            onChange={setPriority}
          />
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <SegmentedControl<TaskStatus>
            options={[
              { label: 'To Do', value: 'TODO' },
              { label: 'In Progress', value: 'IN_PROGRESS' },
              { label: 'Completed', value: 'COMPLETED' },
            ]}
            value={status}
            onChange={setStatus}
          />
        </div>

        {/* Assigned To */}
        <div>
          <label className={labelClass}>Assigned To</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Contact typeahead */}
        <div>
          <label className={labelClass}>Contact</label>
          {selectedContact ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
                {selectedContact.firstName} {selectedContact.lastName}
                <button
                  type="button"
                  onClick={() => { setSelectedContact(null); setContactSearch('') }}
                  className="ml-0.5 text-blue-400 hover:text-blue-600"
                >
                  <X size={11} />
                </button>
              </span>
            </div>
          ) : (
            <div className="relative">
              <input
                value={contactSearch}
                onChange={(e) => { setContactSearch(e.target.value); searchContacts(e.target.value) }}
                placeholder="Search contacts…"
                className={inputClass}
              />
              {contactResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                  {contactResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedContact(c); setContactSearch(''); setContactResults([]) }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {c.firstName} {c.lastName}
                      {c.email && <span className="ml-1 text-gray-400 text-xs">· {c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Company typeahead */}
        <div>
          <label className={labelClass}>Company</label>
          {selectedCompany ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700">
                {selectedCompany.name}
                <button
                  type="button"
                  onClick={() => { setSelectedCompany(null); setCompanySearch('') }}
                  className="ml-0.5 text-purple-400 hover:text-purple-600"
                >
                  <X size={11} />
                </button>
              </span>
            </div>
          ) : (
            <div className="relative">
              <input
                value={companySearch}
                onChange={(e) => { setCompanySearch(e.target.value); searchCompanies(e.target.value) }}
                placeholder="Search companies…"
                className={inputClass}
              />
              {companyResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                  {companyResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCompany(c); setCompanySearch(''); setCompanyResults([]) }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recurring */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#0D1B2A]"
            />
            <span className={cn(labelClass, 'mb-0')}>Recurring Task</span>
          </label>
          {isRecurring && (
            <div className="mt-2 flex flex-col gap-1">
              <select
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                className={inputClass}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              {dueDate && (
                <p className="text-xs text-gray-400 mt-1">
                  Next occurrence: {nextOccurrenceDate(dueDate, recurrenceRule)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Load from template */}
        {templates.length > 0 && (
          <div>
            <label className={labelClass}>Load from Template</label>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) loadTemplate(e.target.value) }}
              className={inputClass}
            >
              <option value="">— Select template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}
