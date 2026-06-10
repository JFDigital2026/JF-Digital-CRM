'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { UserPlus, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type TableColumn } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/search-input'
import { FilterSidebar, type FilterSectionConfig } from '@/components/ui/filter-sidebar'
import { StatusBadge } from '@/components/ui/status-badge'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { ActionMenu } from '@/components/ui/action-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ContactFormModal } from '@/components/contacts/contact-form-modal'
import { CSVImportModal } from '@/components/contacts/csv-import-modal'
import { ContactSlideOver } from '@/components/contacts/contact-slide-over'
import { format } from 'date-fns'

const STATUS_VARIANT: Record<string, any> = {
  NEW: 'info', TRIAL: 'purple', ACTIVE: 'success',
  LOST: 'neutral', CANNOT_CONTACT: 'error', CLOSED: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  NEW: 'New', TRIAL: 'Trial', ACTIVE: 'Active',
  LOST: 'Lost', CANNOT_CONTACT: 'Cannot Contact', CLOSED: 'Closed',
}
const LEAD_STATUSES = Object.keys(STATUS_LABEL)

type Contact = {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  leadStatus: string
  doNotContact: boolean
  tags: string[]
  company?: { id: string; name: string }
  createdAt: string
}

const FILTER_SECTIONS: FilterSectionConfig[] = [
  {
    key: 'leadStatus',
    label: 'Lead Status',
    type: 'checkbox',
    options: [
      { value: 'NEW', label: 'New' },
      { value: 'TRIAL', label: 'Trial' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'LOST', label: 'Lost' },
      { value: 'CANNOT_CONTACT', label: 'Cannot Contact' },
      { value: 'CLOSED', label: 'Closed' },
    ],
  },
  {
    key: 'doNotContact',
    label: 'Do Not Contact',
    type: 'checkbox',
    options: [{ value: 'true', label: 'Show DNC only' }],
  },
  {
    key: 'created',
    label: 'Created Date',
    type: 'date-range',
  },
]

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [editContact, setEditContact] = useState<any>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<any[]>([])

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', '25')
    if (search) params.set('search', search)
    if (filters.leadStatus?.length) filters.leadStatus.forEach((s: string) => params.append('leadStatus[]', s))
    if (filters.doNotContact?.includes('true')) params.set('doNotContact', 'true')
    if (filters.created?.from) params.set('dateFrom', filters.created.from)
    if (filters.created?.to) params.set('dateTo', filters.created.to)
    const res = await fetch(`/api/contacts?${params}`)
    const data = await res.json()
    setContacts(data.contacts ?? [])
    setTotalCount(data.total ?? 0)
    setLoading(false)
  }, [page, search, filters])

  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => {
    fetch('/api/custom-fields')
      .then((r) => r.ok ? r.json() : [])
      .then(setCustomFields)
      .catch(() => {})
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/contacts/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    fetchContacts()
  }

  const columns: TableColumn<Contact>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <CRMAvatar name={`${row.firstName} ${row.lastName}`} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{row.firstName} {row.lastName}</p>
            {row.doNotContact && (
              <span className="text-[10px] font-bold text-red-500">DNC</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      render: (row) => row.company
        ? <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{row.company.name}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'leadStatus',
      header: 'Status',
      render: (row) => (
        <select
          value={row.leadStatus}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            e.stopPropagation()
            await fetch(`/api/contacts/${row.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ leadStatus: e.target.value }),
            })
            fetchContacts()
          }}
          className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium outline-none focus:border-[#415A77] cursor-pointer"
          style={{ color: STATUS_VARIANT[row.leadStatus] === 'success' ? '#059669' : STATUS_VARIANT[row.leadStatus] === 'error' ? '#dc2626' : STATUS_VARIANT[row.leadStatus] === 'info' ? '#2563eb' : '#6b7280' }}
        >
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-sm text-gray-600">{row.email ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-sm text-gray-600">{row.phone ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-sm text-gray-500">{format(new Date(row.createdAt), 'MMM d, yyyy')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <ActionMenu
          items={[
            { label: 'Edit', onClick: () => setEditContact(row) },
            { label: 'View Full Profile', onClick: () => setSelectedContactId(row.id) },
            { label: 'Delete', onClick: () => setDeleteId(row.id), danger: true, separator: true },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <FilterSidebar
        sections={FILTER_SECTIONS}
        value={filters}
        onChange={(key, val) => { setFilters((prev) => ({ ...prev, [key]: val })); setPage(1) }}
        onClearAll={() => { setFilters({}); setPage(1) }}
        className="shrink-0"
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <PageHeader
          title="Contacts"
          subtitle={`${totalCount} total`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Upload size={15} />
                Import CSV
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors"
              >
                <UserPlus size={15} />
                New Contact
              </button>
            </div>
          }
        />

        <div className="mt-4 mb-4">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search by name, email, phone, or company…"
            className="max-w-sm"
          />
        </div>

        <DataTable
          columns={columns}
          data={contacts}
          loading={loading}
          onRowClick={(row) => setSelectedContactId(row.id)}
          getRowId={(row) => row.id}
          getRowClassName={(row) => row.doNotContact ? 'bg-red-50/40' : undefined}
          page={page}
          pageSize={25}
          totalCount={totalCount}
          onPageChange={setPage}
          bulkActions={[
            {
              label: 'Delete Selected',
              onClick: async (ids) => {
                await Promise.all(ids.map((id) => fetch(`/api/contacts/${id}`, { method: 'DELETE' })))
                fetchContacts()
              },
              danger: true,
            },
          ]}
        />
      </div>

      {/* Slide-over */}
      <ContactSlideOver
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        onEdit={(contact) => {
          setSelectedContactId(null)
          setEditContact(contact)
        }}
      />

      {/* New Contact modal */}
      <ContactFormModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSuccess={fetchContacts}
        customFields={customFields}
      />

      {/* Edit Contact modal */}
      <ContactFormModal
        open={!!editContact}
        onClose={() => setEditContact(null)}
        onSuccess={() => { fetchContacts(); if (selectedContactId) setSelectedContactId(editContact?.id ?? null) }}
        customFields={customFields}
        initialData={editContact}
        contactId={editContact?.id}
      />

      {/* CSV Import modal */}
      <CSVImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchContacts}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        description="This will permanently delete the contact and all associated data. This cannot be undone."
        destructive
      />
    </div>
  )
}
