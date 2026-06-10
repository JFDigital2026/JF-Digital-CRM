'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ExternalLink, Users, Briefcase, Trash2,
  Circle, Clock, CheckSquare, Plus, Building2, User,
  FileText, Activity, CheckCircle2, X, CreditCard, Download,
  ChevronDown, RefreshCw, Calendar, Link as LinkIcon,
} from 'lucide-react'
import { format, formatDistanceToNow, addWeeks, addMonths } from 'date-fns'
import { TabGroup } from '@/components/ui/tab-group'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { InlineField } from '@/components/contacts/inline-field'
import { TaskFormModal } from '@/components/tasks/task-form-modal'
import { Modal } from '@/components/ui/modal'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { FileUploader, type UploadedFile } from '@/components/ui/file-uploader'
import nextDynamic from 'next/dynamic'
import { ContactSlideOver } from '@/components/contacts/contact-slide-over'
import { AddCardModal } from '@/components/companies/add-card-modal'
import { cn } from '@/lib/utils'

const OrgChart = nextDynamic(
  () => import('@/components/companies/org-chart').then((m) => ({ default: m.OrgChart })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-xl bg-gray-100" />,
    ssr: false,
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED'

interface Contact {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  title?: string | null
  role?: string | null
  leadStatus: string
}

interface Opportunity {
  id: string
  title: string
  value?: number | null
  closeDate?: string | null
  outcome?: string | null
  stage?: { name: string; color?: string | null }
}

interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: string
  dueDate?: string | null
  contact?: { id: string; firstName: string; lastName: string } | null
}

interface ActivityLog {
  id: string
  type: string
  description: string
  createdAt: string
  metadata?: unknown
  user?: { name?: string | null }
  contactId?: string | null
  opportunityId?: string | null
}

interface FileAttachment {
  id: string
  name: string
  url: string
  size: number
  type: string
}

interface BillingSubscription {
  id: string
  status: string
  createdAt: string
  nextBillingDate?: string | null
  scheduledStartDate?: string | null
  customAmount?: number | null
  cancelledAt?: string | null
  stripeCustomerId?: string | null
  contact: { id: string; firstName: string; lastName: string; email?: string | null } | null
  product: { id: string; name: string; type: string; interval?: string | null; price: number }
}

interface BillingOrder {
  id: string
  status: string
  amount: number
  createdAt: string
  contact: { id: string; firstName: string; lastName: string; email?: string | null } | null
  product: { id: string; name: string; type: string }
  invoices: { id: string; number: string; status: string; sentAt?: string | null }[]
}

interface BillingInvoice {
  id: string
  number: string
  amount: number
  currency: string
  status: string
  pdfUrl?: string | null
  sentAt?: string | null
  createdAt: string
  contact: { id: string; firstName: string; lastName: string }
  order: { product: { id: string; name: string } }
}

interface PaymentMethod {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

interface AppointmentAttendee {
  id: string
  name: string
  role?: string | null
}

interface AppointmentCase {
  id: string
  title: string
  appointmentDate: string
  fathomLink?: string | null
  notes?: string | null
  createdAt: string
  attendees: AppointmentAttendee[]
}

interface Product {
  id: string
  name: string
  type: string
  price: number
}

interface EnrollmentForm {
  productId: string
  contactId: string
  chargeType: 'deposit' | 'on_completion' | 'recurring'
  amount: string
}

interface Company {
  id: string
  name: string
  website?: string | null
  industry?: string | null
  companySize?: string | null
  location?: string | null
  notes?: string | null
  lastProjectSummary?: string | null
  lastProjectDate?: string | null
  hierarchyJson?: Record<string, string | null> | null
  createdAt: string
  contacts: Contact[]
  opportunities: Opportunity[]
  fileAttachments: FileAttachment[]
  activityLogs?: ActivityLog[]
  _count: { contacts: number; opportunities: number; tasks: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: 'TODO',
}

const BOTTOM_TABS = [
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'activity', label: 'Activity' },
  { key: 'files', label: 'Files' },
  { key: 'billing', label: 'Billing' },
  { key: 'cases', label: 'Cases' },
]

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

const FOLLOW_UP_OPTIONS = [
  { label: '1 week', fn: () => addWeeks(new Date(), 1) },
  { label: '2 weeks', fn: () => addWeeks(new Date(), 2) },
  { label: '1 month', fn: () => addMonths(new Date(), 1) },
  { label: '2 months', fn: () => addMonths(new Date(), 2) },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'TODO') return <Circle size={16} className="text-gray-300 shrink-0" />
  if (status === 'IN_PROGRESS') return <Clock size={16} className="text-amber-500 shrink-0" />
  return <CheckSquare size={16} className="text-emerald-500 shrink-0" />
}

function ActivityDot({ type }: { type: string }) {
  if (type.startsWith('task.')) return <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
  if (type.startsWith('contact.')) return <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
  if (type.startsWith('company.')) return <div className="h-2 w-2 rounded-full bg-gray-400 shrink-0 mt-1.5" />
  if (type.startsWith('opportunity.')) return <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
  return <div className="h-2 w-2 rounded-full bg-gray-300 shrink-0 mt-1.5" />
}

// ─── Card 3-dot menu ─────────────────────────────────────────────────────────

function CardMenu({
  pm,
  onMakePrimary,
  onEdit,
  onDelete,
}: {
  pm: { isDefault: boolean }
  onMakePrimary: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 outline-none"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {!pm.isDefault && (
            <button
              onClick={() => { setOpen(false); onMakePrimary() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-3.5 w-3.5 text-[#415A77]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Make Primary
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onEdit() }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <div className="my-1 h-px bg-gray-100" />
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CompanyDetailPageInner({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [slideOverContactId, setSlideOverContactId] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Contact[]>([])
  const [showContactSearch, setShowContactSearch] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskDueDate, setTaskDueDate] = useState('')
  const [activeFollowUp, setActiveFollowUp] = useState<string | null>(null)

  // Opportunities state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [oppsLoading, setOppsLoading] = useState(false)
  const [showOppModal, setShowOppModal] = useState(false)
  const [pipelines, setPipelines] = useState<{ id: string; name: string; stages: { id: string; name: string; color?: string | null }[] }[]>([])
  const [oppForm, setOppForm] = useState({ title: '', value: '', stageId: '', closeDate: '' })
  const [oppSaving, setOppSaving] = useState(false)

  // Activity state
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Files state
  const [files, setFiles] = useState<UploadedFile[]>([])

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingSubscriptions, setBillingSubscriptions] = useState<BillingSubscription[]>([])
  const [billingOrders, setBillingOrders] = useState<BillingOrder[]>([])
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [cancellingSubId, setCancellingSubId] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [cancelOnBillingLoad, setCancelOnBillingLoad] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [editCard, setEditCard] = useState<PaymentMethod | null>(null)
  const [editExpMonth, setEditExpMonth] = useState('')
  const [editExpYear, setEditExpYear] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Re-Enroll modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollProducts, setEnrollProducts] = useState<Product[]>([])
  const [enrollForm, setEnrollForm] = useState<EnrollmentForm>({
    productId: '',
    contactId: '',
    chargeType: 'deposit',
    amount: '',
  })
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  // Cases state
  const [cases, setCases] = useState<AppointmentCase[]>([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [showCaseModal, setShowCaseModal] = useState(false)
  const [caseSaving, setCaseSaving] = useState(false)
  const [caseForm, setCaseForm] = useState({
    title: '',
    appointmentDate: '',
    fathomLink: '',
    notes: '',
    attendees: [{ name: '', role: '' }],
  })
  const [attendeeSearch, setAttendeeSearch] = useState<string[]>([''])
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null)
  const [confirmDeleteCaseId, setConfirmDeleteCaseId] = useState<string | null>(null)

  // Mark Build Complete modal state
  const [showMarkComplete, setShowMarkComplete] = useState(false)
  const [markCompleteDate, setMarkCompleteDate] = useState('')
  const [markCompleteSaving, setMarkCompleteSaving] = useState(false)
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null)

  // Bottom tab state — honour ?tab= query param (e.g. after Stripe setup redirect)
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab')
    return BOTTOM_TABS.some((b) => b.key === t) ? t! : 'opportunities'
  })

  // ─── Fetch company ──────────────────────────────────────────────────────────

  const fetchCompany = useCallback(async () => {
    const res = await fetch(`/api/companies/${params.id}`)
    if (!res.ok) return
    const data: Company = await res.json()
    setCompany(data)
    setContacts(data.contacts ?? [])
    setFiles(data.fileAttachments ?? [])
    if (data.activityLogs) setActivity(data.activityLogs)
    setLoading(false)
  }, [params.id])

  useEffect(() => { fetchCompany() }, [fetchCompany])

  // ─── Patch field ────────────────────────────────────────────────────────────

  const patch = useCallback(async (field: string, value: string) => {
    const res = await fetch(`/api/companies/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    const updated = await res.json()
    setCompany(updated)
  }, [params.id])

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    await fetch(`/api/companies/${params.id}`, { method: 'DELETE' })
    router.push('/companies')
  }

  // ─── Contacts ───────────────────────────────────────────────────────────────

  const doContactSearch = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setContactResults([]); return }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=5`)
      const data = await res.json()
      setContactResults(data.contacts ?? [])
    }, 250)
  }, [])

  const handleContactSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactSearch(e.target.value)
    doContactSearch(e.target.value)
  }

  const linkContact = async (contactId: string) => {
    await fetch(`/api/companies/${params.id}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId }),
    })
    setContactSearch('')
    setContactResults([])
    setShowContactSearch(false)
    // Refresh contacts
    const res = await fetch(`/api/companies/${params.id}/contacts`)
    const data = await res.json()
    setContacts(Array.isArray(data) ? data : [])
    // Update count
    setCompany((prev) => prev ? {
      ...prev,
      _count: { ...prev._count, contacts: prev._count.contacts + 1 }
    } : prev)
  }

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await fetch(`/api/companies/${params.id}/tasks`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } finally {
      setTasksLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasks()
  }, [activeTab, fetchTasks])

  const cycleTaskStatus = async (task: Task) => {
    const nextStatus = TASK_STATUS_CYCLE[task.status]
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    fetchTasks()
  }

  const handleFollowUpPreset = (label: string, dateFn: () => Date) => {
    const d = dateFn()
    const iso = format(d, 'yyyy-MM-dd')
    setTaskDueDate(iso)
    setActiveFollowUp(label)
    setShowTaskModal(true)
  }

  // ─── Opportunities ──────────────────────────────────────────────────────────

  const fetchOpportunities = useCallback(async () => {
    setOppsLoading(true)
    try {
      const res = await fetch(`/api/opportunities?companyId=${params.id}`)
      const data = res.ok ? await res.json() : {}
      setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : [])
    } finally {
      setOppsLoading(false)
    }
  }, [params.id])

  const fetchPipelines = useCallback(async () => {
    const res = await fetch('/api/pipelines')
    const data = await res.json()
    setPipelines(Array.isArray(data) ? data : [])
    if (data[0]?.stages?.[0]?.id) {
      setOppForm((f) => ({ ...f, stageId: data[0].stages[0].id, title: company?.name ?? '' }))
    }
  }, [company?.name])

  useEffect(() => {
    if (activeTab === 'opportunities') fetchOpportunities()
  }, [activeTab, fetchOpportunities])

  const openOppModal = async () => {
    await fetchPipelines()
    setOppForm((f) => ({
      ...f,
      title: company?.name ?? '',
      value: '',
      closeDate: '',
    }))
    setShowOppModal(true)
  }

  const handleOppSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oppForm.stageId) return
    setOppSaving(true)
    const pipeline = pipelines.find((p) => p.stages.some((s) => s.id === oppForm.stageId))
    await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: oppForm.title || (company?.name ?? 'Opportunity'),
        value: oppForm.value ? parseFloat(oppForm.value) : null,
        stageId: oppForm.stageId,
        pipelineId: pipeline?.id,
        companyId: params.id,
        closeDate: oppForm.closeDate || null,
      }),
    })
    setOppSaving(false)
    setShowOppModal(false)
    fetchOpportunities()
    setCompany((prev) => prev ? {
      ...prev,
      _count: { ...prev._count, opportunities: prev._count.opportunities + 1 }
    } : prev)
  }

  // ─── Activity ───────────────────────────────────────────────────────────────

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await fetch(`/api/companies/${params.id}/activity`)
      const data = await res.json()
      setActivity(Array.isArray(data) ? data : [])
    } finally {
      setActivityLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (activeTab === 'activity') fetchActivity()
  }, [activeTab, fetchActivity])

  // ─── Billing ────────────────────────────────────────────────────────────────

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true)
    try {
      const res = await fetch(`/api/companies/${params.id}/billing`)
      if (!res.ok) return
      const data = await res.json()
      setBillingSubscriptions(data.subscriptions ?? [])
      setBillingOrders(data.orders ?? [])
      setBillingInvoices(data.invoices ?? [])
      setPaymentMethods(data.paymentMethods ?? [])
    } finally {
      setBillingLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (activeTab === 'billing') fetchBilling()
  }, [activeTab, fetchBilling])

  useEffect(() => {
    if (!cancelOnBillingLoad || billingLoading || billingSubscriptions.length === 0) return
    const first = billingSubscriptions.find((s) => s.status === 'ACTIVE')
    if (first) setShowCancelConfirm(first.id)
    setCancelOnBillingLoad(false)
  }, [cancelOnBillingLoad, billingLoading, billingSubscriptions])

  const cancelSubscription = async (subId: string) => {
    setCancellingSubId(subId)
    try {
      await fetch(`/api/subscriptions/${subId}/cancel`, { method: 'PATCH' })
      await fetchBilling()
    } finally {
      setCancellingSubId(null)
      setShowCancelConfirm(null)
    }
  }

  const handleAddCard = () => {
    setShowAddCard(true)
  }

  const handleDeleteCard = async (pmId: string) => {
    await fetch(`/api/companies/${params.id}/billing/cards`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodId: pmId }),
    })
    fetchBilling()
  }

  const handleMakePrimary = async (pmId: string) => {
    await fetch(`/api/companies/${params.id}/billing/cards`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'make_primary', paymentMethodId: pmId }),
    })
    fetchBilling()
  }

  const handleEditCard = (pm: PaymentMethod) => {
    setEditCard(pm)
    setEditExpMonth(String(pm.expMonth).padStart(2, '0'))
    setEditExpYear(String(pm.expYear))
    setEditError(null)
  }

  const handleSaveEditCard = async () => {
    if (!editCard) return
    setEditSaving(true)
    setEditError(null)
    const res = await fetch(`/api/companies/${params.id}/billing/cards`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_expiry',
        paymentMethodId: editCard.id,
        expMonth: parseInt(editExpMonth),
        expYear: parseInt(editExpYear),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setEditError(data.error ?? 'Update failed.')
    } else {
      setEditCard(null)
      fetchBilling()
    }
    setEditSaving(false)
  }

  const handleMarkComplete = async () => {
    setMarkCompleteSaving(true)
    setMarkCompleteError(null)
    const res = await fetch(`/api/companies/${params.id}/billing/mark-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retainerStartDate: markCompleteDate || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMarkCompleteError(data.error ?? 'Failed to complete.')
    } else {
      setShowMarkComplete(false)
      setMarkCompleteDate('')
      fetchBilling()
      fetchCompany()
    }
    setMarkCompleteSaving(false)
  }

  // ─── Re-Enroll ──────────────────────────────────────────────────────────────

  const openEnrollModal = async () => {
    setEnrollError(null)
    setEnrollForm({ productId: '', contactId: '', chargeType: 'deposit', amount: '' })
    if (enrollProducts.length === 0) {
      const res = await fetch('/api/products')
      const data = await res.json()
      const prods: Product[] = (data.products ?? []).map((p: Product) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price: p.price,
      }))
      setEnrollProducts(prods)
    }
    setShowEnrollModal(true)
  }

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollForm.productId) return
    setEnrollSaving(true)
    setEnrollError(null)
    const selectedProduct = enrollProducts.find((p) => p.id === enrollForm.productId)
    const amount = enrollForm.amount ? parseFloat(enrollForm.amount) : (selectedProduct?.price ?? 0)
    const selectedContact = contacts.find((c) => c.id === enrollForm.contactId)
    const res = await fetch('/api/enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: company?.name ?? '',
        existingCompanyId: params.id,
        firstName: selectedContact?.firstName,
        lastName: selectedContact?.lastName,
        email: selectedContact?.email,
        services: [{
          productId: enrollForm.productId,
          amount,
          chargeType: enrollForm.chargeType,
        }],
      }),
    })
    const data = await res.json()
    setEnrollSaving(false)
    if (!res.ok) {
      setEnrollError(data.error ?? 'Enrollment failed.')
    } else {
      setShowEnrollModal(false)
      if (activeTab === 'billing') fetchBilling()
      else { setActiveTab('billing'); fetchBilling() }
    }
  }

  // ─── Cases ──────────────────────────────────────────────────────────────────

  const fetchCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      const res = await fetch(`/api/companies/${params.id}/cases`)
      if (!res.ok) { setCases([]); return }
      const text = await res.text()
      if (!text) { setCases([]); return }
      const data = JSON.parse(text)
      setCases(Array.isArray(data) ? data : [])
    } catch {
      setCases([])
    } finally {
      setCasesLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (activeTab === 'cases') fetchCases()
  }, [activeTab, fetchCases])

  const handleCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseForm.title || !caseForm.appointmentDate) return
    setCaseSaving(true)
    const res = await fetch(`/api/companies/${params.id}/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: caseForm.title,
        appointmentDate: caseForm.appointmentDate,
        fathomLink: caseForm.fathomLink || null,
        notes: caseForm.notes || null,
        attendees: caseForm.attendees.filter((a) => a.name.trim()),
      }),
    })
    setCaseSaving(false)
    if (res.ok) {
      setShowCaseModal(false)
      setCaseForm({ title: '', appointmentDate: '', fathomLink: '', notes: '', attendees: [{ name: '', role: '' }] })
      setAttendeeSearch([''])
      fetchCases()
    }
  }

  const handleDeleteCase = async (caseId: string) => {
    setDeletingCaseId(caseId)
    await fetch(`/api/companies/${params.id}/cases/${caseId}`, { method: 'DELETE' })
    setDeletingCaseId(null)
    setConfirmDeleteCaseId(null)
    fetchCases()
  }

  // ─── Hierarchy ──────────────────────────────────────────────────────────────

  const handleHierarchyUpdate = useCallback(async (hierarchyJson: Record<string, string | null>) => {
    setCompany((prev) => prev ? { ...prev, hierarchyJson } : prev)
    await fetch(`/api/companies/${params.id}/hierarchy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hierarchyJson }),
    })
  }, [params.id])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton variant="list" className="p-6" />
  if (!company) return (
    <div className="flex items-center justify-center h-full">
      <EmptyState title="Company not found" description="This company may have been deleted." />
    </div>
  )

  const allStages = pipelines.flatMap((p) => p.stages)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50">
      {/* Back nav */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/companies')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} /> Companies
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-4">

        {/* ── TOP SECTION: Company Header Card ─────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Left: logo + fields */}
            <div className="flex flex-1 gap-4 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0D1B2A] text-xl font-bold text-white">
                {company.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <InlineField
                  label=""
                  value={company.name}
                  onSave={(v) => patch('name', v)}
                  className="mb-0"
                />
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {company.website && (
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-[#415A77] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={11} /> {company.website}
                    </a>
                  )}
                  {company.industry && (
                    <span className="rounded-full bg-[#415A77]/10 text-[#415A77] px-2.5 py-0.5 text-xs font-semibold">
                      {company.industry}
                    </span>
                  )}
                  {(company.companySize || company.location) && (
                    <span className="text-xs text-gray-400">
                      {[company.companySize, company.location].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                {/* Last project */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <InlineField
                    label="Last Project"
                    value={company.lastProjectSummary}
                    type="textarea"
                    onSave={(v) => patch('lastProjectSummary', v)}
                    placeholder="Add last project summary…"
                  />
                  <InlineField
                    label="Completed"
                    value={company.lastProjectDate ? format(new Date(company.lastProjectDate), 'yyyy-MM-dd') : ''}
                    type="text"
                    onSave={(v) => patch('lastProjectDate', v)}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
            </div>

            {/* Right: quick actions — 2 left, 3 right */}
            <div className="flex gap-2 shrink-0">
              {/* Left column: billing actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleAddCard}
                                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CreditCard size={12} /> Add Card
                </button>
                <button
                  onClick={() => {
                    setActiveTab('billing')
                    const firstActive = billingSubscriptions.find((s) => s.status === 'ACTIVE')
                    if (firstActive) {
                      setShowCancelConfirm(firstActive.id)
                    } else {
                      setCancelOnBillingLoad(true)
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
              {/* Right column: CRM actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowContactSearch(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1B263B] transition-colors"
                >
                  <User size={12} /> Add Contact
                </button>
                <button
                  onClick={() => { setTaskDueDate(''); setActiveFollowUp(null); setShowTaskModal(true) }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CheckCircle2 size={12} /> Add Task
                </button>
                <button
                  onClick={openOppModal}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Briefcase size={12} /> Add Opportunity
                </button>
                <button
                  onClick={openEnrollModal}
                  className="flex items-center gap-1.5 rounded-lg bg-[#415A77] px-3 py-2 text-xs font-medium text-white hover:bg-[#0D1B2A] transition-colors"
                >
                  <RefreshCw size={12} /> Re-Enroll
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MIDDLE SECTION: Contacts + Org Chart ──────────────────────────── */}
        <div className="flex gap-4" style={{ minHeight: 400 }}>
          {/* Left: Contacts */}
          <div className="w-[55%] flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Contacts</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                  {company._count.contacts}
                </span>
              </div>
              <button
                onClick={() => setShowContactSearch((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Plus size={11} /> Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {contacts.length === 0 ? (
                <EmptyState title="No contacts" description="Add contacts to this company." />
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSlideOverContactId(c.id)}
                    className="flex items-start gap-2.5 rounded-lg border border-gray-100 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <CRMAvatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 leading-snug">
                        {c.firstName} {c.lastName}
                      </p>
                      {(c.title || c.role) && (
                        <p className="text-xs text-gray-500">{c.title ?? c.role}</p>
                      )}
                      {(c.email || c.phone) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[c.email, c.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Inline contact search */}
              {showContactSearch && (
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-600">Search existing contacts</p>
                    <button onClick={() => { setShowContactSearch(false); setContactSearch(''); setContactResults([]) }}>
                      <X size={13} className="text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      autoFocus
                      value={contactSearch}
                      onChange={handleContactSearchChange}
                      placeholder="Type to search…"
                      className={inputClass}
                    />
                    {contactResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                        {contactResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => linkContact(c.id)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {c.firstName} {c.lastName}
                            {c.email && <span className="ml-1.5 text-xs text-gray-400">{c.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/contacts/new?companyId=${params.id}`)}
                      className="text-xs text-[#415A77] hover:text-[#0D1B2A] font-medium"
                    >
                      + Create new contact
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Org Chart */}
          <div className="w-[45%] flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Org Chart</h2>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3">
              <OrgChart
                contacts={contacts}
                hierarchyJson={company.hierarchyJson ?? null}
                onUpdate={handleHierarchyUpdate}
              />
            </div>
          </div>
        </div>

        {/* ── BOTTOM SECTION: Tabs ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <TabGroup tabs={BOTTOM_TABS} active={activeTab} onChange={setActiveTab} className="px-4" />

          <div className="p-4">
            {/* Opportunities Tab */}
            {activeTab === 'opportunities' && (
              <div className="flex flex-col gap-2">
                {oppsLoading ? (
                  <LoadingSkeleton variant="list" rows={3} />
                ) : opportunities.length === 0 ? (
                  <EmptyState title="No opportunities" description="Add an opportunity to track deals." />
                ) : (
                  opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{opp.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          {opp.stage && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                background: (opp.stage.color ?? '#415A77') + '20',
                                color: opp.stage.color ?? '#415A77',
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: opp.stage.color ?? '#415A77' }}
                              />
                              {opp.stage.name}
                            </span>
                          )}
                          {opp.closeDate && (
                            <span className="text-xs text-gray-400">
                              Close {format(new Date(opp.closeDate), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      {opp.value != null && (
                        <p className="text-sm font-semibold text-gray-900 shrink-0 ml-3">
                          ${opp.value.toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))
                )}
                <button
                  onClick={openOppModal}
                  className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
                >
                  <Plus size={14} /> Add Opportunity
                </button>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="flex flex-col gap-2">
                {/* Follow-up presets */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs text-gray-400 font-medium mr-1">Follow up in:</span>
                  {FOLLOW_UP_OPTIONS.map(({ label, fn }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleFollowUpPreset(label, fn)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                        activeFollowUp === label
                          ? 'border-[#415A77] bg-[#415A77]/10 text-[#415A77]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tasksLoading ? (
                  <LoadingSkeleton variant="list" rows={3} />
                ) : tasks.length === 0 ? (
                  <EmptyState title="No tasks" description="Add a task to track work for this company." />
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3">
                      <button
                        onClick={() => cycleTaskStatus(task)}
                        className="mt-0.5 shrink-0 focus:outline-none"
                        aria-label={`Status: ${task.status}. Click to advance.`}
                      >
                        <TaskStatusIcon status={task.status} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium text-gray-900 leading-snug',
                            task.status === 'COMPLETED' && 'line-through text-gray-400'
                          )}
                        >
                          {task.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                          {task.dueDate && (
                            <span>Due {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                          )}
                          {task.contact && (
                            <span>{task.contact.firstName} {task.contact.lastName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={() => { setTaskDueDate(''); setActiveFollowUp(null); setShowTaskModal(true) }}
                  className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
                >
                  <Plus size={14} /> Add Task
                </button>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div>
                {activityLoading ? (
                  <LoadingSkeleton variant="list" rows={5} />
                ) : activity.length === 0 ? (
                  <EmptyState title="No activity yet" />
                ) : (
                  <div className="flex flex-col">
                    {activity.map((log) => (
                      <div key={log.id} className="flex gap-3 border-b border-gray-50 py-3 last:border-0">
                        <ActivityDot type={log.type} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900">{log.description}</p>
                          <p className="text-xs text-gray-400">
                            {log.user?.name && <span>{log.user.name} · </span>}
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <FileUploader
                companyId={params.id}
                existingFiles={files}
                onUploadComplete={(f) => setFiles((prev) => [...prev, f])}
                onDeleteFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              />
            )}

            {/* Cases Tab */}
            {activeTab === 'cases' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Appointment Cases</h3>
                  <button
                    onClick={() => {
                      setCaseForm({ title: '', appointmentDate: '', fathomLink: '', notes: '', attendees: [{ name: '', role: '' }] })
                      setAttendeeSearch([''])
                      setShowCaseModal(true)
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#415A77] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0D1B2A] transition-colors"
                  >
                    <Plus size={12} /> Add Case
                  </button>
                </div>

                {casesLoading ? (
                  <LoadingSkeleton variant="list" rows={3} />
                ) : cases.length === 0 ? (
                  <EmptyState title="No cases yet" description="Log appointment cases and Fathom recordings for this company." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {cases.map((c) => (
                      <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Calendar size={11} />
                                {format(new Date(c.appointmentDate), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            {c.fathomLink && (
                              <a
                                href={c.fathomLink.startsWith('http') ? c.fathomLink : `https://${c.fathomLink}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-[#415A77] hover:underline"
                              >
                                <LinkIcon size={11} /> Fathom Recording
                              </a>
                            )}
                            {c.attendees.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {c.attendees.map((a) => (
                                  <span
                                    key={a.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-[#415A77]/10 px-2 py-0.5 text-xs text-[#415A77]"
                                  >
                                    <User size={10} />
                                    {a.name}{a.role ? ` · ${a.role}` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                            {c.notes && (
                              <p className="mt-2 text-xs text-gray-500 leading-relaxed whitespace-pre-line">{c.notes}</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {confirmDeleteCaseId === c.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Delete?</span>
                                <button
                                  onClick={() => handleDeleteCase(c.id)}
                                  disabled={deletingCaseId === c.id}
                                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {deletingCaseId === c.id ? '…' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteCaseId(null)}
                                  className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteCaseId(c.id)}
                                className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                aria-label="Delete case"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div className="flex flex-col gap-6">
                {billingLoading ? (
                  <LoadingSkeleton variant="list" rows={4} />
                ) : (
                  <>
                    {/* ── Pending Build items ── */}
                    {(() => {
                      const pendingOrders = billingOrders.filter((o) => o.status === 'PENDING_COMPLETION')
                      const pendingSubs   = billingSubscriptions.filter((s) => s.status === 'PENDING')
                      const hasPending    = pendingOrders.length > 0 || pendingSubs.length > 0
                      if (!hasPending) return null
                      const pendingTotal  = pendingOrders.reduce((sum, o) => sum + o.amount, 0)
                      return (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Pending Build</h3>
                            <button
                              onClick={() => { setMarkCompleteError(null); setShowMarkComplete(true) }}
                              className="flex items-center gap-1.5 rounded-lg bg-[#415A77] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0D1B2A] transition-colors"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Mark Build Complete
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {pendingOrders.map((order) => (
                              <div key={order.id} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 p-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900">{order.product.name}</p>
                                  <p className="mt-0.5 text-xs text-amber-700">Due on completion</p>
                                </div>
                                <span className="text-sm font-semibold text-gray-900">${order.amount.toLocaleString()}</span>
                              </div>
                            ))}
                            {pendingSubs.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 p-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900">{sub.product.name}</p>
                                  <p className="mt-0.5 text-xs text-blue-700">
                                    Monthly retainer · ${(sub.customAmount ?? sub.product.price).toLocaleString()}/mo
                                    {sub.scheduledStartDate && (
                                      <> · starts {format(new Date(sub.scheduledStartDate), 'MMM d, yyyy')}</>
                                    )}
                                  </p>
                                </div>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Pending</span>
                              </div>
                            ))}
                          </div>
                          {pendingTotal > 0 && (
                            <p className="mt-2 text-right text-xs text-gray-400">
                              Pending charge: <span className="font-semibold text-gray-700">${pendingTotal.toLocaleString()}</span>
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Active Subscriptions */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Active Subscriptions</h3>
                        <button
                          onClick={openEnrollModal}
                          className="flex items-center gap-1 rounded-lg bg-[#415A77] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0D1B2A] transition-colors"
                        >
                          <Plus size={11} /> Enroll
                        </button>
                      </div>
                      {billingSubscriptions.filter((s) => s.status === 'ACTIVE').length === 0 ? (
                        <p className="text-sm text-gray-400">No active subscriptions.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {billingSubscriptions.filter((s) => s.status === 'ACTIVE').map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">{sub.product.name}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                                  <span>${(sub.customAmount ?? sub.product.price).toLocaleString()}/{sub.product.interval?.toLowerCase() ?? 'mo'}</span>
                                  {sub.contact && (
                                    <>
                                      <span>·</span>
                                      <span>{sub.contact.firstName} {sub.contact.lastName}</span>
                                    </>
                                  )}
                                  {sub.nextBillingDate && (
                                    <>
                                      <span>·</span>
                                      <span>Next: {format(new Date(sub.nextBillingDate), 'MMM d, yyyy')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="ml-3 shrink-0">
                                {showCancelConfirm === sub.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Confirm cancel?</span>
                                    <button
                                      onClick={() => cancelSubscription(sub.id)}
                                      disabled={cancellingSubId === sub.id}
                                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                      {cancellingSubId === sub.id ? 'Cancelling…' : 'Yes, cancel'}
                                    </button>
                                    <button
                                      onClick={() => setShowCancelConfirm(null)}
                                      className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    >
                                      Keep
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowCancelConfirm(sub.id)}
                                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cancelled subscriptions (collapsed) */}
                      {billingSubscriptions.filter((s) => s.status !== 'ACTIVE' && s.status !== 'PENDING').length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 list-none flex items-center gap-1">
                            <ChevronDown size={12} />
                            {billingSubscriptions.filter((s) => s.status !== 'ACTIVE' && s.status !== 'PENDING').length} cancelled/inactive
                          </summary>
                          <div className="mt-2 flex flex-col gap-2">
                            {billingSubscriptions.filter((s) => s.status !== 'ACTIVE' && s.status !== 'PENDING').map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 opacity-60">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-700">{sub.product.name}</p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                                    <span className="capitalize">{sub.status.toLowerCase()}</span>
                                    {sub.cancelledAt && (
                                      <>
                                        <span>·</span>
                                        <span>Cancelled {format(new Date(sub.cancelledAt), 'MMM d, yyyy')}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>

                    {/* Payment Methods / Card Info */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Card on File</h3>
                        <button
                          onClick={handleAddCard}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <CreditCard size={12} />
                          {paymentMethods.length === 0 ? 'Add Card' : 'Add New Card'}
                        </button>
                      </div>
                      {paymentMethods.length === 0 ? (
                        <p className="text-sm text-gray-400">No card on file.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {paymentMethods.map((pm) => (
                            <div
                              key={pm.id}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                                pm.isDefault
                                  ? 'border-[#415A77]/30 bg-[#415A77]/5'
                                  : 'border-gray-100 bg-white'
                              )}
                            >
                              <CreditCard size={16} className={pm.isDefault ? 'text-[#415A77] shrink-0' : 'text-gray-400 shrink-0'} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 capitalize">{pm.brand} ···· {pm.last4}</p>
                                  {pm.isDefault && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#415A77] px-2 py-0.5 text-[10px] font-semibold text-white">
                                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">Expires {String(pm.expMonth).padStart(2,'0')}/{pm.expYear}</p>
                              </div>
                              {/* Card actions */}
                              <CardMenu
                                pm={pm}
                                onMakePrimary={() => handleMakePrimary(pm.id)}
                                onEdit={() => handleEditCard(pm)}
                                onDelete={() => handleDeleteCard(pm.id)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Payment History */}
                    {(() => {
                      const historyOrders = billingOrders.filter((o) => o.status !== 'PENDING_COMPLETION')
                      return (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Payment History</h3>
                          {historyOrders.length === 0 ? (
                            <p className="text-sm text-gray-400">No payments yet.</p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border border-gray-100">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {historyOrders.map((order) => (
                                    <tr key={order.id} className="bg-white">
                                      <td className="px-3 py-2 text-gray-900">{order.product.name}</td>
                                      <td className="px-3 py-2 text-gray-900">${order.amount.toLocaleString()}</td>
                                      <td className="px-3 py-2">
                                        <span className={cn(
                                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                          order.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                                          order.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                                          order.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                                          'bg-gray-100 text-gray-600'
                                        )}>
                                          {order.status.toLowerCase().replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-gray-400 text-xs">
                                        {format(new Date(order.createdAt), 'MMM d, yyyy')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Invoices */}
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Invoices</h3>
                      {billingInvoices.length === 0 ? (
                        <p className="text-sm text-gray-400">No invoices yet.</p>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-gray-100">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Invoice #</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                <th className="px-3 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {billingInvoices.map((inv) => (
                                <tr key={inv.id} className="bg-white">
                                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{inv.number}</td>
                                  <td className="px-3 py-2 text-gray-900">{inv.order.product.name}</td>
                                  <td className="px-3 py-2 text-gray-900">${inv.amount.toLocaleString()}</td>
                                  <td className="px-3 py-2">
                                    <span className={cn(
                                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                      inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                                      inv.status === 'SENT' ? 'bg-blue-50 text-blue-700' :
                                      inv.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                                      'bg-red-50 text-red-700'
                                    )}>
                                      {inv.status.toLowerCase()}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-400 text-xs">
                                    {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {inv.pdfUrl ? (
                                      <a
                                        href={inv.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                                      >
                                        <Download size={12} /> PDF
                                      </a>
                                    ) : (
                                      <span className="text-xs text-gray-300">No PDF</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="flex justify-end pb-2">
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Delete Company
          </button>
        </div>
      </div>

      {/* ── Modals & SlideOvers ──────────────────────────────────────────────── */}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Company"
        description="This will permanently delete the company. Linked contacts will remain but lose their company association."
        destructive
      />

      <TaskFormModal
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setTaskDueDate(''); setActiveFollowUp(null) }}
        onSuccess={() => {
          setShowTaskModal(false)
          setTaskDueDate('')
          setActiveFollowUp(null)
          if (activeTab === 'tasks') fetchTasks()
        }}
        initialCompany={{ id: params.id, name: company.name }}
      />

      {/* Add Opportunity Modal */}
      <Modal open={showOppModal} onClose={() => setShowOppModal(false)} title="Add Opportunity" size="md">
        <form onSubmit={handleOppSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
            <input
              value={oppForm.title}
              onChange={(e) => setOppForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={company.name}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Value ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={oppForm.value}
                onChange={(e) => setOppForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Close Date</label>
              <input
                type="date"
                value={oppForm.closeDate}
                onChange={(e) => setOppForm((f) => ({ ...f, closeDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Stage *</label>
            <select
              required
              value={oppForm.stageId}
              onChange={(e) => setOppForm((f) => ({ ...f, stageId: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Select stage —</option>
              {pipelines.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {p.stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => setShowOppModal(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={oppSaving || !oppForm.stageId}
              className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
            >
              {oppSaving ? 'Adding…' : 'Add Opportunity'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Contact SlideOver */}
      <ContactSlideOver
        contactId={slideOverContactId}
        onClose={() => setSlideOverContactId(null)}
        onEdit={() => {}}
      />

      <AddCardModal
        open={showAddCard}
        companyId={params.id}
        companyName={company.name}
        onClose={() => setShowAddCard(false)}
        onSuccess={() => { setShowAddCard(false); fetchBilling() }}
      />

      {/* Mark Build Complete modal */}
      {showMarkComplete && (() => {
        const pendingOrders = billingOrders.filter((o) => o.status === 'PENDING_COMPLETION')
        const pendingSubs   = billingSubscriptions.filter((s) => s.status === 'PENDING')
        const pendingTotal  = pendingOrders.reduce((sum, o) => sum + o.amount, 0)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !markCompleteSaving && setShowMarkComplete(false)} />
            <div className="relative w-full max-w-sm rounded-2xl bg-white px-6 py-7 shadow-2xl">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-4.5 w-4.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-900">Mark Build Complete</h2>
              </div>
              <p className="mb-5 text-sm text-gray-400">This will charge the completion payment and schedule the monthly retainer.</p>

              {pendingOrders.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Charge now</p>
                  {pendingOrders.map((o) => (
                    <div key={o.id} className="flex justify-between text-sm text-gray-700">
                      <span>{o.product.name}</span>
                      <span className="font-semibold">${o.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {pendingTotal > 0 && (
                    <div className="mt-1 flex justify-between border-t border-amber-100 pt-1 text-sm font-bold text-gray-900">
                      <span>Total</span>
                      <span>${pendingTotal.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {pendingSubs.length > 0 && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Monthly retainer starts <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={markCompleteDate}
                    onChange={(e) => setMarkCompleteDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20"
                  />
                  {pendingSubs.map((s) => (
                    <p key={s.id} className="mt-1.5 text-xs text-gray-400">
                      {s.product.name} · ${(s.customAmount ?? s.product.price).toLocaleString()}/mo
                    </p>
                  ))}
                </div>
              )}

              {markCompleteError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{markCompleteError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowMarkComplete(false)}
                  disabled={markCompleteSaving}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkComplete}
                  disabled={markCompleteSaving || (pendingSubs.length > 0 && !markCompleteDate)}
                  className="flex-1 rounded-lg bg-[#415A77] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D1B2A] disabled:opacity-50 transition-colors"
                >
                  {markCompleteSaving ? 'Processing…' : pendingTotal > 0 ? `Charge $${pendingTotal.toLocaleString()}` : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Re-Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !enrollSaving && setShowEnrollModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white px-6 py-7 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#415A77]/10">
                  <RefreshCw size={16} className="text-[#415A77]" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Re-Enroll / Add Product</h2>
              </div>
              <button onClick={() => setShowEnrollModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEnrollSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Product *</label>
                <select
                  required
                  value={enrollForm.productId}
                  onChange={(e) => {
                    const prod = enrollProducts.find((p) => p.id === e.target.value)
                    setEnrollForm((f) => ({
                      ...f,
                      productId: e.target.value,
                      amount: prod ? String(prod.price) : '',
                      chargeType: prod?.type === 'SUBSCRIPTION' ? 'recurring' : prod?.type === 'ONE_TIME' ? 'deposit' : f.chargeType,
                    }))
                  }}
                  className={inputClass}
                >
                  <option value="">— Select product —</option>
                  {enrollProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ${p.price.toLocaleString()} · {p.type.replace('_', ' ').toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Contact (optional)</label>
                <select
                  value={enrollForm.contactId}
                  onChange={(e) => setEnrollForm((f) => ({ ...f, contactId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— No specific contact —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}{c.email ? ` · ${c.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={enrollForm.amount}
                    onChange={(e) => setEnrollForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Charge Type</label>
                  <select
                    value={enrollForm.chargeType}
                    onChange={(e) => setEnrollForm((f) => ({ ...f, chargeType: e.target.value as EnrollmentForm['chargeType'] }))}
                    className={inputClass}
                  >
                    <option value="deposit">Deposit (charge now)</option>
                    <option value="on_completion">On completion</option>
                    <option value="recurring">Recurring subscription</option>
                  </select>
                </div>
              </div>
              {enrollError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{enrollError}</p>
              )}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  disabled={enrollSaving}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSaving || !enrollForm.productId}
                  className="rounded-lg bg-[#415A77] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D1B2A] disabled:opacity-50 transition-colors"
                >
                  {enrollSaving ? 'Enrolling…' : 'Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Case Modal */}
      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !caseSaving && setShowCaseModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white px-6 py-7 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#415A77]/10">
                  <Calendar size={16} className="text-[#415A77]" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Add Appointment Case</h2>
              </div>
              <button onClick={() => setShowCaseModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCaseSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Appointment Title *</label>
                <input
                  required
                  value={caseForm.title}
                  onChange={(e) => setCaseForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Strategy call - Q3 review"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Appointment Date &amp; Time *</label>
                <input
                  required
                  type="datetime-local"
                  value={caseForm.appointmentDate}
                  onChange={(e) => setCaseForm((f) => ({ ...f, appointmentDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Fathom Recording Link (optional)</label>
                <input
                  type="url"
                  value={caseForm.fathomLink}
                  onChange={(e) => setCaseForm((f) => ({ ...f, fathomLink: e.target.value }))}
                  placeholder="https://fathom.video/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={caseForm.notes}
                  onChange={(e) => setCaseForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Key takeaways, action items..."
                  className={inputClass}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Attendees</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCaseForm((f) => ({ ...f, attendees: [...f.attendees, { name: '', role: '' }] }))
                      setAttendeeSearch((prev) => [...prev, ''])
                    }}
                    className="flex items-center gap-1 text-xs text-[#415A77] hover:text-[#0D1B2A] font-medium"
                  >
                    <Plus size={11} /> Add row
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {caseForm.attendees.map((att, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1 relative">
                        <input
                          value={attendeeSearch[idx] ?? att.name}
                          onChange={(e) => {
                            const v = e.target.value
                            setAttendeeSearch((prev) => { const n = [...prev]; n[idx] = v; return n })
                            setCaseForm((f) => {
                              const a = [...f.attendees]
                              a[idx] = { ...a[idx], name: v }
                              return { ...f, attendees: a }
                            })
                          }}
                          placeholder="Name"
                          className={inputClass}
                          list={`attendee-suggestions-${idx}`}
                        />
                        <datalist id={`attendee-suggestions-${idx}`}>
                          {contacts
                            .filter((c) => {
                              const q = (attendeeSearch[idx] ?? '').toLowerCase()
                              return !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
                            })
                            .map((c) => (
                              <option key={c.id} value={`${c.firstName} ${c.lastName}`} />
                            ))}
                        </datalist>
                      </div>
                      <input
                        value={att.role}
                        onChange={(e) => {
                          const v = e.target.value
                          setCaseForm((f) => {
                            const a = [...f.attendees]
                            a[idx] = { ...a[idx], role: v }
                            return { ...f, attendees: a }
                          })
                        }}
                        placeholder="Role (optional)"
                        className={cn(inputClass, 'w-32')}
                      />
                      {caseForm.attendees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCaseForm((f) => ({ ...f, attendees: f.attendees.filter((_, i) => i !== idx) }))
                            setAttendeeSearch((prev) => prev.filter((_, i) => i !== idx))
                          }}
                          className="mt-1 rounded p-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCaseModal(false)}
                  disabled={caseSaving}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={caseSaving || !caseForm.title || !caseForm.appointmentDate}
                  className="rounded-lg bg-[#415A77] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D1B2A] disabled:opacity-50 transition-colors"
                >
                  {caseSaving ? 'Saving…' : 'Save Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Card modal */}
      {editCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditCard(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white px-6 py-7 shadow-2xl">
            <h2 className="mb-1 text-base font-bold text-gray-900">Edit Card</h2>
            <p className="mb-5 text-sm text-gray-400">
              <span className="capitalize">{editCard.brand}</span> ending in {editCard.last4}
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Exp Month</label>
                  <input
                    value={editExpMonth}
                    onChange={(e) => setEditExpMonth(e.target.value)}
                    placeholder="MM"
                    maxLength={2}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Exp Year</label>
                  <input
                    value={editExpYear}
                    onChange={(e) => setEditExpYear(e.target.value)}
                    placeholder="YYYY"
                    maxLength={4}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20"
                  />
                </div>
              </div>
              {editError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEditCard(null)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditCard}
                disabled={editSaving}
                className="flex-1 rounded-lg bg-[#415A77] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D1B2A] disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <CompanyDetailPageInner params={params} />
    </Suspense>
  )
}
