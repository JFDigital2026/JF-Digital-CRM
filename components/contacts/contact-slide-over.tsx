'use client'

import React, { useState, useEffect } from 'react'
import { ExternalLink, Edit, Mail, Phone, MessageSquare, CheckSquare, Clock, Circle, Plus, Trash2, User, Pencil, RefreshCw, CheckCircle2, FileText, ClipboardList, Download } from 'lucide-react'
import { TaskFormModal } from '@/components/tasks/task-form-modal'
import { useRouter } from 'next/navigation'
import { SlideOver } from '@/components/ui/slide-over'
import { TabGroup } from '@/components/ui/tab-group'
import { StatusBadge } from '@/components/ui/status-badge'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { FileUploader, type UploadedFile } from '@/components/ui/file-uploader'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

const STATUS_VARIANT: Record<string, any> = {
  NEW: 'info', TRIAL: 'purple', ACTIVE: 'success',
  LOST: 'neutral', CANNOT_CONTACT: 'error', CLOSED: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  NEW: 'New', TRIAL: 'Trial', ACTIVE: 'Active',
  LOST: 'Lost', CANNOT_CONTACT: 'Cannot Contact', CLOSED: 'Closed',
}
const TASK_STATUS_ICON: Record<string, React.ElementType> = {
  TODO: Circle, IN_PROGRESS: Clock, COMPLETED: CheckSquare,
}
const CHANNEL_ICON: Record<string, React.ElementType> = {
  EMAIL: Mail, SMS: Phone, INSTAGRAM: MessageSquare,
  FACEBOOK: MessageSquare, LINKEDIN: MessageSquare,
}

const ACTIVITY_ICON_MAP: Record<string, React.ElementType> = {
  'contact.created': User,
  'contact.updated': Pencil,
  'status.changed': RefreshCw,
  'task.created': CheckCircle2,
  'note.added': FileText,
  'message.sent': MessageSquare,
  'contacts.imported': Download,
}
function ActivityIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICON_MAP[type] ?? ClipboardList
  return <Icon size={14} style={{color:'#415A77'}} />
}

interface ContactSlideOverProps {
  contactId: string | null
  onClose: () => void
  onEdit: (contact: any) => void
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'messages', label: 'Messages' },
  { key: 'files', label: 'Files' },
]

export function ContactSlideOver({ contactId, onClose, onEdit }: ContactSlideOverProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tabData, setTabData] = useState<Record<string, any>>({})
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({})

  // Fetch contact when id changes
  useEffect(() => {
    if (!contactId) { setContact(null); setTabData({}); return }
    setLoading(true)
    setActiveTab('overview')
    fetch(`/api/contacts/${contactId}`)
      .then((r) => r.json())
      .then((d) => { setContact(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [contactId])

  // Fetch tab data lazily
  const fetchTab = async (tab: string) => {
    if (tab === 'overview' || tabData[tab] || !contactId) return
    setTabLoading((p) => ({ ...p, [tab]: true }))
    try {
      const endpoints: Record<string, string> = {
        activity: `/api/contacts/${contactId}/activity`,
        tasks: `/api/contacts/${contactId}/tasks`,
        notes: `/api/conversation-notes?contactId=${contactId}`,
        messages: `/api/contacts/${contactId}/messages`,
        files: `/api/files?contactId=${contactId}`,
      }
      const res = await fetch(endpoints[tab])
      const data = await res.json()
      setTabData((p) => ({ ...p, [tab]: data }))
    } finally {
      setTabLoading((p) => ({ ...p, [tab]: false }))
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    fetchTab(tab)
  }

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [notes, setNotes] = useState<any[]>([])

  const refreshTasks = async () => {
    if (!contactId) return
    setTabLoading((p) => ({ ...p, tasks: true }))
    const res = await fetch(`/api/contacts/${contactId}/tasks`)
    const data = await res.json()
    setTabData((p) => ({ ...p, tasks: data }))
    setTabLoading((p) => ({ ...p, tasks: false }))
  }

  const cycleTaskStatus = async (task: any) => {
    const next: Record<string, string> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: 'TODO' }
    const nextStatus = next[task.status] ?? 'TODO'
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    await refreshTasks()
  }

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  useEffect(() => {
    if (tabData.files) setUploadedFiles(tabData.files)
  }, [tabData.files])

  useEffect(() => {
    if (tabData.notes) setNotes(Array.isArray(tabData.notes) ? tabData.notes : (tabData.notes.notes ?? []))
  }, [tabData.notes])

  // Reset notes when contact changes
  useEffect(() => {
    setNotes([])
    setNoteInput('')
  }, [contactId])

  const handleSaveNote = async () => {
    if (!contactId || !noteInput.trim() || savingNote) return
    setSavingNote(true)
    const res = await fetch('/api/conversation-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, body: noteInput }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setNoteInput('')
    }
    setSavingNote(false)
  }

  const handleDeleteNote = async (id: string) => {
    await fetch(`/api/conversation-notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter((n: any) => n.id !== id))
  }

  return (
    <SlideOver
      open={!!contactId}
      onClose={onClose}
      title={contact ? `${contact.firstName} ${contact.lastName}` : 'Contact'}
      width={440}
      headerAction={
        contact && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(contact)}
              className="flex items-center gap-1 rounded-md border-2 border-[#415A77] px-2 py-1 text-xs font-medium text-[#415A77] hover:bg-[#415A77]/10 transition-colors"
            >
              <Edit size={12} /> Edit
            </button>
            <button
              onClick={() => { onClose(); router.push(`/contacts/${contactId}`) }}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <ExternalLink size={12} /> Full View
            </button>
          </div>
        )
      }
    >
      {loading && <LoadingSkeleton variant="list" rows={4} className="p-5" />}

      {!loading && contact && (
        <div className="flex flex-col">
          {/* Contact header */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 pb-4 pt-4">
            <CRMAvatar name={`${contact.firstName} ${contact.lastName}`} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-base font-semibold text-gray-900">
                  {contact.firstName} {contact.lastName}
                </h3>
                {contact.doNotContact && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">DNC</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge variant={STATUS_VARIANT[contact.leadStatus]} label={STATUS_LABEL[contact.leadStatus]} dot />
              </div>
              {contact.title && <p className="mt-0.5 text-xs text-gray-500">{contact.title}</p>}
            </div>
          </div>

          {/* Tabs */}
          <TabGroup tabs={TABS} active={activeTab} onChange={handleTabChange} className="px-5" />

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-4">
                {[
                  ['Email', contact.email],
                  ['Phone', contact.phone],
                  ['Role', contact.role],
                  ['Source', contact.source],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs font-medium text-gray-500">{label}</p>
                    <p className="text-sm text-gray-900">{value}</p>
                  </div>
                ))}

                {contact.company && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Company</p>
                    <button
                      onClick={() => router.push(`/companies/${contact.company.id}`)}
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#0D1B2A]/5 px-2.5 py-1 text-xs font-medium text-[#0D1B2A] hover:bg-[#0D1B2A]/10"
                    >
                      {contact.company.name}
                      <ExternalLink size={10} />
                    </button>
                  </div>
                )}

                {contact.tags?.filter((t: string) => t !== '__unverified__').length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-500">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.filter((t: string) => t !== '__unverified__').map((t: string) => (
                        <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {contact.customFieldValues?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Custom Fields</p>
                    {contact.customFieldValues.map((cfv: any) => (
                      <div key={cfv.id} className="mb-2">
                        <p className="text-xs font-medium text-gray-500">{cfv.customField.name}</p>
                        <p className="text-sm text-gray-900">{cfv.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {contact.notes && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">Notes</p>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{contact.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              tabLoading.activity
                ? <LoadingSkeleton variant="list" rows={4} />
                : !tabData.activity?.length
                  ? <EmptyState title="No activity yet" />
                  : (
                    <div className="flex flex-col gap-0">
                      {tabData.activity.map((log: any) => (
                        <div key={log.id} className="flex gap-3 border-b border-gray-50 py-3 last:border-0">
                          <ActivityIcon type={log.type} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">{log.description}</p>
                            <p className="text-xs text-gray-400">
                              {log.user?.name} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
            )}

            {activeTab === 'tasks' && (
              <div className="flex flex-col gap-3">
                {tabLoading.tasks
                  ? <LoadingSkeleton variant="list" rows={3} />
                  : !tabData.tasks?.length
                    ? <EmptyState title="No tasks" description="Add a task to track follow-ups" />
                    : tabData.tasks.map((task: any) => {
                      const Icon = TASK_STATUS_ICON[task.status] ?? Circle
                      return (
                        <div key={task.id} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3">
                          <button
                            onClick={() => cycleTaskStatus(task)}
                            title="Cycle status"
                            className="mt-0.5 shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-[#415A77]/40"
                          >
                            <Icon size={14} className={cn(
                              task.status === 'COMPLETED' ? 'text-emerald-500' :
                              task.status === 'IN_PROGRESS' ? 'text-amber-500' : 'text-gray-400'
                            )} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm font-medium', task.status === 'COMPLETED' && 'line-through text-gray-400')}>{task.title}</p>
                            {task.dueDate && (
                              <p className="text-xs text-gray-400">{format(new Date(task.dueDate), 'MMM d, yyyy')}</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                }

                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-1.5 text-sm text-[#415A77] hover:text-[#0D1B2A] transition-colors"
                >
                  <Plus size={14} /> Add Task
                </button>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="flex flex-col gap-3">
                {/* Add note */}
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

                {/* Note list */}
                {tabLoading.notes
                  ? <LoadingSkeleton variant="list" rows={2} />
                  : notes.length === 0
                    ? <EmptyState title="No notes yet" description="Add a note above to track details about this contact." />
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

            {activeTab === 'messages' && (
              tabLoading.messages
                ? <LoadingSkeleton variant="list" rows={3} />
                : !tabData.messages?.length
                  ? <EmptyState title="No messages" />
                  : (
                    <div className="flex flex-col gap-2">
                      {tabData.messages.map((msg: any) => {
                        const Icon = CHANNEL_ICON[msg.channel] ?? MessageSquare
                        return (
                          <div key={msg.id} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <Icon size={13} className="text-gray-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              {msg.subject && <p className="text-xs font-semibold text-gray-700">{msg.subject}</p>}
                              <p className="line-clamp-2 text-xs text-gray-600">{msg.body}</p>
                              <p className="mt-0.5 text-[10px] text-gray-400">
                                {msg.direction === 'INBOUND' ? '← Received' : '→ Sent'} · {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      <button
                        onClick={() => { onClose(); router.push('/inbox') }}
                        className="text-xs text-[#415A77] hover:text-[#0D1B2A] text-left"
                      >
                        Open in Inbox →
                      </button>
                    </div>
                  )
            )}

            {activeTab === 'files' && (
              <FileUploader
                contactId={contactId ?? undefined}
                existingFiles={uploadedFiles}
                onUploadComplete={(f) => setUploadedFiles((prev) => [...prev, f])}
                onDeleteFile={(id) => setUploadedFiles((prev) => prev.filter((f) => f.id !== id))}
              />
            )}
          </div>
        </div>
      )}

      <TaskFormModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSuccess={refreshTasks}
        initialContact={contact ? { id: contactId!, firstName: contact.firstName, lastName: contact.lastName } : null}
      />
    </SlideOver>
  )
}
