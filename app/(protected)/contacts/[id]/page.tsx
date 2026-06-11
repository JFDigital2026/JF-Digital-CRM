'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Trash2, Circle, Clock, CheckSquare, Mail, Phone, MessageSquare, Plus, X, CreditCard, User, Pencil, RefreshCw, CheckCircle2, FileText, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { TabGroup } from '@/components/ui/tab-group'
import { StatusBadge } from '@/components/ui/status-badge'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { FileUploader, type UploadedFile } from '@/components/ui/file-uploader'
import { InlineField } from '@/components/contacts/inline-field'
import { CustomFieldInput } from '@/components/contacts/custom-field-input'
import { TaskFormModal } from '@/components/tasks/task-form-modal'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

const DEFAULT_STATUS_VARIANT: Record<string, any> = {
  NEW: 'info', TRIAL: 'purple', ACTIVE: 'success',
  LOST: 'neutral', CANNOT_CONTACT: 'error', CLOSED: 'warning',
}
const DEFAULT_STATUS_LABEL: Record<string, string> = {
  NEW: 'New', TRIAL: 'Trial', ACTIVE: 'Active',
  LOST: 'Lost', CANNOT_CONTACT: 'Cannot Contact', CLOSED: 'Closed',
}

const TASK_STATUS_ICON: Record<string, React.ElementType> = {
  TODO: Circle, IN_PROGRESS: Clock, COMPLETED: CheckSquare,
}
const NEXT_TASK_STATUS: Record<string, string> = {
  TODO: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: 'TODO',
}
const CHANNEL_ICON: Record<string, React.ElementType> = {
  EMAIL: Mail, SMS: Phone, INSTAGRAM: MessageSquare, FACEBOOK: MessageSquare, LINKEDIN: MessageSquare,
}
const ACTIVITY_ICON_MAP: Record<string, React.ElementType> = {
  'contact.created': User,
  'contact.updated': Pencil,
  'status.changed': RefreshCw,
  'task.created': CheckCircle2,
  'note.added': FileText,
  'message.sent': MessageSquare,
}
function ActivityIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICON_MAP[type] ?? ClipboardList
  return <Icon size={14} style={{color:'#415A77'}} />
}

const RIGHT_TABS = [
  { key: 'activity', label: 'Activity' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'messages', label: 'Messages' },
  { key: 'files', label: 'Files' },
  { key: 'opportunities', label: 'Deals' },
  { key: 'associations', label: 'Associations' },
  { key: 'appointments', label: 'Appointments' },
]

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()

  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [leadStatusOptions, setLeadStatusOptions] = useState<{ value: string; label: string; color?: string }[]>(
    Object.entries(DEFAULT_STATUS_LABEL).map(([value, label]) => ({ value, label }))
  )
  const [activeTab, setActiveTab] = useState('activity')
  const [tabData, setTabData] = useState<Record<string, any>>({})
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({})
  const [customFields, setCustomFields] = useState<any[]>([])
  const [showDelete, setShowDelete] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [notes, setNotes] = useState<any[]>([])
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [msgChannel, setMsgChannel] = useState<'SMS' | 'EMAIL'>('SMS')
  const [msgSubject, setMsgSubject] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgSending, setMsgSending] = useState(false)

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((d) => { setContact(d); setLoading(false) })
  }, [id])

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.ok ? r.json() : []).then(setCustomFields).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/option-lists')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.leadStatus?.items) setLeadStatusOptions(d.leadStatus.items) })
      .catch(() => {})
  }, [])

  const fetchTab = async (tab: string, currentContact?: any) => {
    if (tabData[tab]) return
    setTabLoading((p) => ({ ...p, [tab]: true }))
    try {
      const c = currentContact ?? contact
      const endpoints: Record<string, string> = {
        activity: `/api/contacts/${id}/activity`,
        tasks: `/api/contacts/${id}/tasks`,
        notes: `/api/conversation-notes?contactId=${id}`,
        messages: `/api/contacts/${id}/messages`,
        files: `/api/files?contactId=${id}`,
        opportunities: `/api/contacts/${id}/opportunities`,
        appointments: `/api/contacts/${id}/appointments`,
        associations: c?.companyId
          ? `/api/contacts?companyId=${c.companyId}&pageSize=50`
          : '',
      }
      const url = endpoints[tab]
      if (!url) { setTabData((p) => ({ ...p, [tab]: [] })); return }
      const res = await fetch(url)
      const data = await res.json()
      // associations returns { contacts: [] }, others return arrays directly
      const normalized = tab === 'associations'
        ? (data.contacts ?? []).filter((c: any) => c.id !== id)
        : data
      setTabData((p) => ({ ...p, [tab]: normalized }))
      if (tab === 'files') setUploadedFiles(data)
      if (tab === 'notes') setNotes(Array.isArray(data) ? data : (data.notes ?? []))
    } finally {
      setTabLoading((p) => ({ ...p, [tab]: false }))
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    fetchTab(tab)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTab('activity') }, [id])

  const patch = async (field: string, value: any) => {
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    const updated = await res.json()
    setContact(updated)
    setTabData((p) => ({ ...p, activity: undefined }))
  }

  const patchCustomField = async (cfId: string, value: string) => {
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customFields: { [cfId]: value } }),
    })
  }

  const handleDelete = async () => {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    router.push('/contacts')
  }

  const cycleTaskStatus = async (task: any) => {
    const nextStatus = NEXT_TASK_STATUS[task.status] ?? 'TODO'
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    const res = await fetch(`/api/contacts/${id}/tasks`)
    const data = await res.json()
    setTabData((p) => ({ ...p, tasks: data }))
  }

  const handleSaveNote = async () => {
    if (!noteInput.trim() || savingNote) return
    setSavingNote(true)
    const res = await fetch('/api/conversation-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: id, body: noteInput }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setNoteInput('')
    }
    setSavingNote(false)
  }

  const handleDeleteNote = async (noteId: string) => {
    await fetch(`/api/conversation-notes/${noteId}`, { method: 'DELETE' })
    setNotes(prev => prev.filter((n: any) => n.id !== noteId))
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!msgBody.trim() || msgSending) return
    setMsgSending(true)
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: contact.id,
        channel: msgChannel,
        body: msgBody,
        subject: msgSubject || undefined,
      })
    })
    setMsgSending(false)
    if (res.ok) {
      setShowMessageModal(false)
      setMsgBody('')
      setMsgSubject('')
    }
  }

  if (loading) return <LoadingSkeleton variant="card" />

  if (!contact) return (
    <div className="p-8">
      <EmptyState title="Contact not found" description="This contact may have been deleted." />
    </div>
  )

  const cfValueMap: Record<string, string> = {}
  for (const cfv of contact.customFieldValues ?? []) {
    cfValueMap[cfv.customFieldId] = cfv.value
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/contacts')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Contacts
        </button>
      </div>

      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        subtitle={contact.company?.name}
        className="px-6 pt-4"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (contact.companyId) {
                  router.push(`/companies/${contact.companyId}?tab=billing`)
                } else {
                  alert('No company linked to this contact')
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CreditCard size={14} />
              Make a Payment
            </button>
            <button
              onClick={() => {
                setShowMessageModal(true)
                if (contact.phone) setMsgChannel('SMS')
                else if (contact.email) setMsgChannel('EMAIL')
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B]">
              <MessageSquare size={14} />
              Message
            </button>
            <StatusBadge
              variant={DEFAULT_STATUS_VARIANT[contact.leadStatus] ?? 'neutral'}
              label={leadStatusOptions.find((o) => o.value === contact.leadStatus)?.label ?? contact.leadStatus}
              dot
            />
            {contact.doNotContact && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">DNC</span>
            )}
          </div>
        }
      />

      {/* Body: 60/40 split */}
      <div className="flex flex-1 overflow-hidden px-6 py-4 gap-5">
        {/* Left: editable fields */}
        <div className="w-[60%] overflow-y-auto flex flex-col gap-1 pr-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <CRMAvatar name={`${contact.firstName} ${contact.lastName}`} size="lg" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{contact.firstName} {contact.lastName}</h2>
                {contact.title && <p className="text-sm text-gray-500">{contact.title}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InlineField label="First Name" value={contact.firstName} onSave={(v) => patch('firstName', v)} />
              <InlineField label="Last Name" value={contact.lastName} onSave={(v) => patch('lastName', v)} />
              <InlineField label="Email" value={contact.email} type="email" onSave={(v) => patch('email', v)} />
              <InlineField label="Phone" value={contact.phone} type="tel" onSave={(v) => patch('phone', v)} />
              <InlineField label="Title" value={contact.title} onSave={(v) => patch('title', v)} />
              <InlineField label="Role" value={contact.role} onSave={(v) => patch('role', v)} />
              <InlineField label="Source" value={contact.source} onSave={(v) => patch('source', v)} />
              <InlineField
                label="Lead Status"
                value={contact.leadStatus}
                type="select"
                options={leadStatusOptions.map((o) => o.value)}
                optionLabels={Object.fromEntries(leadStatusOptions.map((o) => [o.value, o.label]))}
                onSave={(v) => patch('leadStatus', v)}
              />
            </div>

            {/* Tags */}
            {contact.tags?.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-gray-500">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((t: string) => (
                    <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Do Not Contact toggle */}
            <label className="mt-4 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={contact.doNotContact}
                onChange={(e) => patch('doNotContact', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Do Not Contact</span>
            </label>

            {/* Notes */}
            <div className="mt-4">
              <InlineField
                label="Notes"
                value={contact.notes}
                type="textarea"
                onSave={(v) => patch('notes', v)}
                placeholder="Click to add notes…"
              />
            </div>
          </div>

          {/* Company card */}
          {contact.company && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Company</p>
              <button
                onClick={() => router.push(`/companies/${contact.company.id}`)}
                className="flex items-center gap-2 text-sm font-medium text-[#0D1B2A] hover:text-[#415A77]"
              >
                {contact.company.name}
                <ExternalLink size={12} className="text-gray-400" />
              </button>
            </div>
          )}

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Custom Fields</p>
              <div className="grid grid-cols-2 gap-4">
                {customFields.map((cf) => (
                  <div key={cf.id}>
                    {cf.type !== 'BOOLEAN' && (
                      <p className="mb-1 text-xs font-medium text-gray-500">{cf.name}</p>
                    )}
                    <CustomFieldInput
                      field={cf}
                      value={cfValueMap[cf.id] ?? ''}
                      onChange={(v) => patchCustomField(cf.id, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Delete Contact
            </button>
          </div>
        </div>

        {/* Right: tab panel */}
        <div className="w-[40%] flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <TabGroup tabs={RIGHT_TABS} active={activeTab} onChange={handleTabChange} className="px-4 overflow-x-auto" />

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Activity */}
            {activeTab === 'activity' && (
              tabLoading.activity
                ? <LoadingSkeleton variant="list" rows={4} />
                : !tabData.activity?.length
                  ? <EmptyState title="No activity yet" />
                  : tabData.activity.map((log: any) => (
                    <div key={log.id} className="flex gap-3 border-b border-gray-50 py-3 last:border-0">
                      <ActivityIcon type={log.type} />
                      <div>
                        <p className="text-sm text-gray-900">{log.description}</p>
                        <p className="text-xs text-gray-400">{log.user?.name} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))
            )}

            {/* Tasks */}
            {activeTab === 'tasks' && (
              <div className="flex flex-col gap-3">
                {tabLoading.tasks
                  ? <LoadingSkeleton variant="list" rows={3} />
                  : !tabData.tasks?.length
                    ? <EmptyState title="No tasks" />
                    : tabData.tasks.map((task: any) => {
                      const Icon = TASK_STATUS_ICON[task.status] ?? Circle
                      return (
                        <div key={task.id} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3">
                          <button
                            onClick={() => cycleTaskStatus(task)}
                            className="mt-0.5 shrink-0 focus:outline-none"
                            title={`Status: ${task.status} — click to advance`}
                          >
                            <Icon size={14} className={cn(
                              task.status === 'COMPLETED' ? 'text-emerald-500' :
                              task.status === 'IN_PROGRESS' ? 'text-amber-500' : 'text-gray-400'
                            )} />
                          </button>
                          <div>
                            <p className={cn('text-sm font-medium', task.status === 'COMPLETED' && 'line-through text-gray-400')}>{task.title}</p>
                            {task.dueDate && <p className="text-xs text-gray-400">{format(new Date(task.dueDate), 'MMM d, yyyy')}</p>}
                          </div>
                        </div>
                      )
                    })
                }
                <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-1.5 text-sm text-[#415A77] hover:text-[#0D1B2A]">
                  <Plus size={14} /> Add Task
                </button>
                <TaskFormModal
                  open={showTaskModal}
                  onClose={() => setShowTaskModal(false)}
                  onSuccess={async () => {
                    const res = await fetch(`/api/contacts/${id}/tasks`)
                    const data = await res.json()
                    setTabData((p) => ({ ...p, tasks: data }))
                  }}
                  initialContact={{ id, firstName: contact.firstName, lastName: contact.lastName }}
                />
              </div>
            )}

            {/* Notes */}
            {activeTab === 'notes' && (
              <div className="flex flex-col gap-3">
                <div>
                  <textarea
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    rows={3}
                    placeholder="Add a note…"
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || !noteInput.trim()}
                    className="mt-1.5 rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B263B] disabled:opacity-40 transition-colors"
                  >
                    {savingNote ? 'Saving…' : 'Add Note'}
                  </button>
                </div>
                {tabLoading.notes
                  ? <LoadingSkeleton variant="list" rows={2} />
                  : notes.length === 0
                    ? <EmptyState title="No notes yet" description="Notes you add here are private to your team." />
                    : notes.map((note: any) => (
                      <div key={note.id} className="group flex items-start gap-2 rounded-lg border border-gray-100 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{note.body}</p>
                          <p className="mt-1 text-[10px] text-gray-400">
                            {note.user?.name ?? 'You'} · {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all shrink-0 mt-0.5"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                }
              </div>
            )}

            {/* Messages */}
            {activeTab === 'messages' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (contact.phone) setMsgChannel('SMS')
                    else if (contact.email) setMsgChannel('EMAIL')
                    setShowMessageModal(true)
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B] self-start">
                  <MessageSquare size={13} />
                  New Message
                </button>
                {tabLoading.messages
                  ? <LoadingSkeleton variant="list" rows={3} />
                  : !tabData.messages?.length
                    ? <EmptyState title="No messages yet" />
                    : tabData.messages.map((msg: any) => {
                        const Icon = CHANNEL_ICON[msg.channel] ?? MessageSquare
                        return (
                          <div key={msg.id} className="mb-2 flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <Icon size={13} className="text-gray-500" />
                            </div>
                            <div>
                              {msg.subject && <p className="text-xs font-semibold text-gray-700">{msg.subject}</p>}
                              <p className="line-clamp-2 text-xs text-gray-600">{msg.body}</p>
                              <p className="mt-0.5 text-[10px] text-gray-400">
                                {msg.direction === 'INBOUND' ? '← Received' : '→ Sent'} · {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        )
                      })
                }
              </div>
            )}

            {/* Files */}
            {activeTab === 'files' && (
              <FileUploader
                contactId={id}
                existingFiles={uploadedFiles}
                onUploadComplete={(f) => setUploadedFiles((prev) => [...prev, f])}
                onDeleteFile={(fid) => setUploadedFiles((prev) => prev.filter((f) => f.id !== fid))}
              />
            )}

            {/* Opportunities */}
            {activeTab === 'opportunities' && (
              tabLoading.opportunities
                ? <LoadingSkeleton variant="list" rows={3} />
                : !tabData.opportunities?.length
                  ? <EmptyState title="No deals" description="Link a deal from the pipeline to this contact." />
                  : tabData.opportunities.map((opp: any) => (
                    <div key={opp.id} className="mb-2 flex items-center justify-between rounded-lg border border-gray-100 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{opp.title}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {opp.stage && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: opp.stage.color + '20', color: opp.stage.color }}
                            >
                              {opp.stage.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {opp.value != null && (
                        <p className="text-sm font-semibold text-gray-900">
                          ${opp.value.toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))
            )}

            {/* Associations */}
            {activeTab === 'associations' && (
              tabLoading.associations
                ? <LoadingSkeleton variant="list" rows={3} />
                : !contact?.companyId
                  ? <EmptyState title="No company linked" description="Assign this contact to a company to see their colleagues." />
                  : !tabData.associations?.length
                    ? <EmptyState title="No other contacts at this company" />
                    : tabData.associations.map((assoc: any) => (
                      <button
                        key={assoc.id}
                        onClick={() => router.push(`/contacts/${assoc.id}`)}
                        className="mb-2 flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <CRMAvatar name={`${assoc.firstName} ${assoc.lastName}`} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{assoc.firstName} {assoc.lastName}</p>
                          {assoc.title && <p className="text-xs text-gray-400">{assoc.title}</p>}
                          {assoc.email && <p className="text-xs text-gray-400">{assoc.email}</p>}
                        </div>
                        <ExternalLink size={12} className="shrink-0 text-gray-300" />
                      </button>
                    ))
            )}

            {/* Appointments */}
            {activeTab === 'appointments' && (
              tabLoading.appointments
                ? <LoadingSkeleton variant="list" rows={3} />
                : !tabData.appointments?.length
                  ? <EmptyState title="No appointments" description="Appointments booked with this contact appear here." />
                  : tabData.appointments.map((appt: any) => (
                    <div key={appt.id} className="mb-2 rounded-lg border border-gray-100 p-3">
                      <p className="text-sm font-medium text-gray-900">{appt.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {format(new Date(appt.startTime), 'MMM d, yyyy · h:mm a')}
                        {appt.endTime && ` – ${format(new Date(appt.endTime), 'h:mm a')}`}
                      </p>
                      {appt.status && (
                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                          {appt.status}
                        </span>
                      )}
                    </div>
                  ))
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Contact"
        description="This will permanently delete this contact and all their data. This cannot be undone."
        destructive
      />

      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowMessageModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Message {contact.firstName} {contact.lastName}
              </h3>
              <button onClick={() => setShowMessageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="p-5 flex flex-col gap-4">
              {/* Channel */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Channel</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['SMS', 'EMAIL'] as const).map(ch => (
                    <button type="button" key={ch} onClick={() => setMsgChannel(ch)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${msgChannel === ch ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                      {ch}
                    </button>
                  ))}
                </div>
                {msgChannel === 'SMS' && !contact.phone && (
                  <p className="text-xs text-red-500 mt-1">This contact has no phone number.</p>
                )}
                {msgChannel === 'EMAIL' && !contact.email && (
                  <p className="text-xs text-red-500 mt-1">This contact has no email address.</p>
                )}
              </div>
              {/* Subject */}
              {msgChannel === 'EMAIL' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Subject</label>
                  <input value={msgSubject} onChange={e => setMsgSubject(e.target.value)}
                    placeholder="Email subject…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
                </div>
              )}
              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Message</label>
                <textarea required value={msgBody} onChange={e => setMsgBody(e.target.value)}
                  rows={4} placeholder="Write your message…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowMessageModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit"
                  disabled={msgSending || !msgBody.trim() || (msgChannel === 'SMS' && !contact.phone) || (msgChannel === 'EMAIL' && !contact.email)}
                  className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-40">
                  {msgSending ? 'Sending…' : `Send ${msgChannel}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
