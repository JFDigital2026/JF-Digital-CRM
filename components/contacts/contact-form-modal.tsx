'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, User, Building2, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { CustomFieldInput, type CustomField } from '@/components/contacts/custom-field-input'
import { cn } from '@/lib/utils'

const LEAD_STATUSES = ['NEW', 'TRIAL', 'ACTIVE', 'LOST', 'CANNOT_CONTACT', 'CLOSED']
const LEAD_LABELS: Record<string, string> = {
  NEW: 'New', TRIAL: 'Trial', ACTIVE: 'Active',
  LOST: 'Lost', CANNOT_CONTACT: 'Cannot Contact', CLOSED: 'Closed',
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Asia/Kolkata',
  'Australia/Sydney', 'Pacific/Auckland',
]

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

interface ContactFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  customFields: CustomField[]
  initialData?: Record<string, any>
  contactId?: string
}

export function ContactFormModal({
  open, onClose, onSuccess, customFields, initialData, contactId,
}: ContactFormModalProps) {
  const isEdit = !!contactId
  const [mode, setMode] = useState<'individual' | 'business'>('individual')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Contact fields
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    title: '', role: '', source: '', notes: '',
    doNotContact: false, leadStatus: 'NEW',
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [cfValues, setCfValues] = useState<Record<string, string>>({})

  // Business fields (only shown in business mode)
  const [biz, setBiz] = useState({
    name: '', website: '', industry: '', companySize: '',
    address: '', city: '', state: '', zip: '', country: '', timezone: '',
  })

  // Company typeahead (individual mode)
  const [companySearch, setCompanySearch] = useState('')
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string }[]>([])
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [showCompanyDrop, setShowCompanyDrop] = useState(false)
  const companyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setForm({
        firstName: initialData.firstName ?? '',
        lastName: initialData.lastName ?? '',
        email: initialData.email ?? '',
        phone: initialData.phone ?? '',
        title: initialData.title ?? '',
        role: initialData.role ?? '',
        source: initialData.source ?? '',
        notes: initialData.notes ?? '',
        doNotContact: initialData.doNotContact ?? false,
        leadStatus: initialData.leadStatus ?? 'NEW',
      })
      setTags(initialData.tags ?? [])
      setSelectedCompany(initialData.company ?? null)
      setCompanySearch(initialData.company?.name ?? '')
      const init: Record<string, string> = {}
      for (const cfv of initialData.customFieldValues ?? []) init[cfv.customFieldId] = cfv.value
      setCfValues(init)
    } else {
      setForm({ firstName: '', lastName: '', email: '', phone: '', title: '', role: '', source: '', notes: '', doNotContact: false, leadStatus: 'NEW' })
      setTags([]); setTagInput(''); setCfValues({})
      setSelectedCompany(null); setCompanySearch(''); setNewCompanyName('')
      setBiz({ name: '', website: '', industry: '', companySize: '', address: '', city: '', state: '', zip: '', country: '', timezone: '' })
      setMode('individual')
    }
    setError('')
  }, [open, initialData])

  const searchCompanies = (q: string) => {
    setCompanySearch(q); setSelectedCompany(null)
    if (companyTimerRef.current) clearTimeout(companyTimerRef.current)
    if (!q.trim()) { setCompanyResults([]); setShowCompanyDrop(false); return }
    companyTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/companies?search=${encodeURIComponent(q)}`)
      const data = await res.json()
      setCompanyResults(Array.isArray(data) ? data : data.companies ?? [])
      setShowCompanyDrop(true)
    }, 250)
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags((p) => [...p, t])
    setTagInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'individual' && !form.firstName.trim()) { setError('First name required'); return }
    if (mode === 'business' && !biz.name.trim()) { setError('Business name required'); return }
    setSaving(true); setError('')
    try {
      if (mode === 'business') {
        // Create company + a linked contact (optional)
        const companyRes = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(biz),
        })
        if (!companyRes.ok) throw new Error(await companyRes.text())
      } else {
        const payload = {
          ...form, tags,
          companyId: selectedCompany?.id ?? null,
          newCompanyName: newCompanyName.trim() || undefined,
          customFields: cfValues,
        }
        const url = isEdit ? `/api/contacts/${contactId}` : '/api/contacts'
        const res = await fetch(url, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(await res.text())
      }
      onSuccess(); onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, type: string = 'text') => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input type={type} value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={inputClass} />
    </div>
  )

  const bizField = (label: string, key: keyof typeof biz, type: string = 'text') => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input type={type} value={biz[key]}
        onChange={(e) => setBiz((b) => ({ ...b, [key]: e.target.value }))}
        className={inputClass} />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Contact' : 'New Contact'} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">

        {/* Mode toggle (only for new) */}
        {!isEdit && (
          <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                mode === 'individual' ? 'bg-[#0D1B2A] text-white' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <User size={14} /> Individual
            </button>
            <button
              type="button"
              onClick={() => setMode('business')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
                mode === 'business' ? 'bg-[#0D1B2A] text-white' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <Building2 size={14} /> Business
            </button>
          </div>
        )}

        {/* ── INDIVIDUAL MODE ── */}
        {mode === 'individual' && (
          <>
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Personal</p>
              <div className="grid grid-cols-2 gap-3">
                {field('First Name *', 'firstName')}
                {field('Last Name', 'lastName')}
                {field('Email', 'email', 'email')}
                {field('Phone', 'phone', 'tel')}
                {field('Title', 'title')}
                {field('Role', 'role')}
                {field('Source', 'source')}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Lead Status</label>
                  <select value={form.leadStatus} onChange={(e) => setForm((f) => ({ ...f, leadStatus: e.target.value }))} className={inputClass}>
                    {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-600">Tags</label>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 min-h-[36px]">
                  {tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {t}
                      <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))}><X size={10} /></button>
                    </span>
                  ))}
                  <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                    placeholder="Type and press Enter…" className="flex-1 text-xs outline-none min-w-[100px] bg-transparent" />
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.doNotContact}
                  onChange={(e) => setForm((f) => ({ ...f, doNotContact: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300" />
                <span className="text-sm text-gray-700">Do Not Contact</span>
              </label>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3} className={cn(inputClass, 'resize-none')} />
              </div>
            </section>

            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Company</p>
              <div className="relative">
                <label className="mb-1 block text-xs font-medium text-gray-600">Search existing company</label>
                <input type="text" value={companySearch}
                  onChange={(e) => searchCompanies(e.target.value)}
                  onFocus={() => companySearch && setShowCompanyDrop(true)}
                  placeholder="Type to search companies…" className={inputClass} />
                {showCompanyDrop && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    {companyResults.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCompany(c); setCompanySearch(c.name); setShowCompanyDrop(false); setNewCompanyName('') }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">{c.name}</button>
                    ))}
                    <button type="button"
                      onClick={() => { setNewCompanyName(companySearch); setSelectedCompany(null); setShowCompanyDrop(false) }}
                      className="block w-full px-3 py-2 text-left text-sm font-medium text-[#415A77] hover:bg-gray-50">
                      <Plus size={13} className="mr-1 inline" />Create "{companySearch}"
                    </button>
                  </div>
                )}
              </div>
              {selectedCompany && <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={12} style={{color:'#27AE60'}} /> Linked to {selectedCompany.name}</p>}
              {newCompanyName && !selectedCompany && <p className="mt-1.5 text-xs text-[#415A77]">Will create new company: {newCompanyName}</p>}
            </section>

            {customFields.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Custom Fields</p>
                <div className="grid grid-cols-2 gap-3">
                  {customFields.map((cf) => (
                    <div key={cf.id}>
                      {cf.type !== 'BOOLEAN' && <label className="mb-1 block text-xs font-medium text-gray-600">{cf.name}</label>}
                      <CustomFieldInput field={cf} value={cfValues[cf.id] ?? ''} onChange={(v) => setCfValues((p) => ({ ...p, [cf.id]: v }))} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── BUSINESS MODE ── */}
        {mode === 'business' && (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Business Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">{bizField('Business Name *', 'name')}</div>
              {bizField('Website', 'website')}
              {bizField('Industry', 'industry')}
              <div className="col-span-2">{bizField('Address', 'address')}</div>
              {bizField('City', 'city')}
              {bizField('State', 'state')}
              {bizField('Zip', 'zip')}
              {bizField('Country', 'country')}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Time Zone</label>
                <select value={biz.timezone} onChange={(e) => setBiz((b) => ({ ...b, timezone: e.target.value }))} className={inputClass}>
                  <option value="">— Select timezone —</option>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
                </select>
              </div>
              {bizField('Company Size', 'companySize')}
            </div>
          </section>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
            {saving ? 'Saving…' : mode === 'business' ? 'Create Business' : isEdit ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
