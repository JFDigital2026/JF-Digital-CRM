'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type TableColumn } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/search-input'
import { ActionMenu } from '@/components/ui/action-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import {
  FilterSidebar,
  type FilterValue,
  type DateRangeFilterValue,
  type CheckboxFilterValue,
} from '@/components/ui/filter-sidebar'

// ─── Types ───────────────────────────────────────────────────────────────────

type Company = {
  id: string
  name: string
  industry?: string | null
  companySize?: string | null
  location?: string | null
  website?: string | null
  lastProjectDate?: string | null
  lastProjectSummary?: string | null
  createdAt: string
  _count: { contacts: number; opportunities: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

const FILTER_SECTIONS = [
  {
    key: 'industry',
    label: 'Industry',
    type: 'checkbox' as const,
    options: [
      { label: 'SaaS', value: 'SaaS' },
      { label: 'Real Estate', value: 'Real Estate' },
      { label: 'Healthcare', value: 'Healthcare' },
      { label: 'Finance', value: 'Finance' },
      { label: 'Marketing', value: 'Marketing' },
      { label: 'Consulting', value: 'Consulting' },
      { label: 'E-commerce', value: 'E-commerce' },
      { label: 'Construction', value: 'Construction' },
      { label: 'Other', value: 'Other' },
    ],
  },
  {
    key: 'companySize',
    label: 'Company Size',
    type: 'checkbox' as const,
    options: [
      { label: '1–10', value: '1-10' },
      { label: '11–50', value: '11-50' },
      { label: '51–200', value: '51-200' },
      { label: '201–500', value: '201-500' },
      { label: '500+', value: '500+' },
    ],
  },
  {
    key: 'lastProjectDate',
    label: 'Last Project Date',
    type: 'date-range' as const,
  },
]

const INITIAL_FILTERS: Record<string, FilterValue> = {
  industry: [] as CheckboxFilterValue,
  companySize: [] as CheckboxFilterValue,
  lastProjectDate: {} as DateRangeFilterValue,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const router = useRouter()

  // List state
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, FilterValue>>(INITIAL_FILTERS)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    website: '',
    industry: '',
    companySize: '',
    location: '',
    notes: '',
  })

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) params.set('search', search)

    const industry = filters.industry as CheckboxFilterValue
    if (industry.length > 0) params.set('industry', industry.join(','))

    const companySize = filters.companySize as CheckboxFilterValue
    if (companySize.length > 0) params.set('companySize', companySize.join(','))

    const dateRange = filters.lastProjectDate as DateRangeFilterValue
    if (dateRange.from) params.set('lastProjectDateFrom', dateRange.from)
    if (dateRange.to) params.set('lastProjectDateTo', dateRange.to)

    try {
      const res = await fetch(`/api/companies?${params}`)
      const data = res.ok ? await res.json() : {}
      setCompanies(data.companies ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setCompanies([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, filters])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // Prefetch the first page of company detail routes so navigation feels instant
  useEffect(() => {
    companies.forEach((c) => router.prefetch(`/companies/${c.id}`))
  }, [companies, router])

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSearchChange = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  const handleFilterChange = (key: string, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleClearAllFilters = () => {
    setFilters(INITIAL_FILTERS)
    setPage(1)
  }

  const resetForm = () =>
    setForm({ name: '', website: '', industry: '', companySize: '', location: '', notes: '' })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        website: form.website.trim() || undefined,
        industry: form.industry.trim() || undefined,
        companySize: form.companySize || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    })
    setCreating(false)
    setShowCreate(false)
    resetForm()
    fetchCompanies()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/companies/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    fetchCompanies()
  }

  // ─── Columns ─────────────────────────────────────────────────────────────

  const columns: TableColumn<Company>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0D1B2A] text-xs font-bold text-white">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industry',
      render: (row) => <span className="text-sm text-gray-600">{row.industry ?? '—'}</span>,
    },
    {
      key: 'companySize',
      header: 'Size',
      render: (row) => <span className="text-sm text-gray-600">{row.companySize ?? '—'}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => <span className="text-sm text-gray-600">{row.location ?? '—'}</span>,
    },
    {
      key: 'contacts',
      header: 'Contacts',
      render: (row) => (
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {row._count.contacts}
        </span>
      ),
    },
    {
      key: 'lastProjectDate',
      header: 'Last Project',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {row.lastProjectDate ? format(new Date(row.lastProjectDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (row) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => router.push(`/companies/${row.id}`) },
            { label: 'Delete', onClick: () => setDeleteId(row.id), danger: true, separator: true },
          ]}
        />
      ),
    },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-3 sm:p-6">
      <PageHeader
        title="Companies"
        subtitle={`${total} total`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 bg-white"
            >
              <SlidersHorizontal size={14} />
              Filters
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Company</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search companies…"
          className="max-w-sm"
        />
      </div>

      <FilterSidebar
        sections={FILTER_SECTIONS}
        value={filters}
        onChange={handleFilterChange}
        onClearAll={handleClearAllFilters}
        mobileOpen={mobileFilterOpen}
        onMobileClose={() => setMobileFilterOpen(false)}
      />

      <div className="flex gap-4">
        {/* Data table */}
        <div className="min-w-0 flex-1">
          <DataTable
            columns={columns}
            data={companies}
            loading={loading}
            onRowClick={(row) => router.push(`/companies/${row.id}`)}
            getRowId={(row) => row.id}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* ── New Company modal ─────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm() }}
        title="New Company"
        size="md"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {/* Company Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Acme Corp"
              className={inputClass}
            />
          </div>

          {/* Website */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://example.com"
              className={inputClass}
            />
          </div>

          {/* Industry + Size row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Industry</label>
              <input
                value={form.industry}
                onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                placeholder="e.g. SaaS"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Size</label>
              <select
                value={form.companySize}
                onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select…</option>
                <option value="1-10">1–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="201-500">201–500</option>
                <option value="500+">500+</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="New York, NY"
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes…"
              className={inputClass}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowCreate(false); resetForm() }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Company"
        description="This will permanently delete the company. Contacts linked to this company will not be deleted."
        destructive
      />
    </div>
  )
}
