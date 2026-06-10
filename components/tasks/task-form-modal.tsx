'use client'

import React, { useState, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

interface TaskFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Pre-fill and lock a contact */
  initialContact?: { id: string; firstName: string; lastName: string } | null
  /** Pre-fill and lock a company */
  initialCompany?: { id: string; name: string } | null
}

export function TaskFormModal({
  open,
  onClose,
  onSuccess,
  initialContact,
  initialCompany,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [creating, setCreating] = useState(false)

  // Contact search (only shown when no initialContact)
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<any[]>([])
  const [selectedContact, setSelectedContact] = useState<any>(null)

  // Company search (only shown when no initialCompany)
  const [companySearch, setCompanySearch] = useState('')
  const [companyResults, setCompanyResults] = useState<any[]>([])
  const [selectedCompany, setSelectedCompany] = useState<any>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = (type: 'contact' | 'company', q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { type === 'contact' ? setContactResults([]) : setCompanyResults([]); return }
    searchTimer.current = setTimeout(async () => {
      if (type === 'contact') {
        const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=5`)
        const data = await res.json()
        setContactResults(data.contacts ?? [])
      } else {
        const res = await fetch(`/api/companies?search=${encodeURIComponent(q)}`)
        const data = await res.json()
        setCompanyResults(Array.isArray(data) ? data : data.companies ?? [])
      }
    }, 250)
  }

  const reset = () => {
    setTitle(''); setDesc(''); setPriority('MEDIUM'); setDueDate('')
    setContactSearch(''); setContactResults([]); setSelectedContact(null)
    setCompanySearch(''); setCompanyResults([]); setSelectedCompany(null)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)

    const contactId = initialContact?.id ?? selectedContact?.id ?? null
    const companyId = initialCompany?.id ?? selectedCompany?.id ?? null

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: desc || null,
        priority,
        dueDate: dueDate || null,
        contactId,
        companyId,
      }),
    })

    setCreating(false)
    reset()
    onSuccess()
    onClose()
  }

  const resolvedContact = initialContact ?? selectedContact
  const resolvedCompany = initialCompany ?? selectedCompany

  return (
    <Modal open={open} onClose={handleClose} title="New Task" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Title *</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title…"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className={cn(inputClass, 'resize-none')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Contact */}
        {initialContact ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Contact</label>
            <div className={cn(inputClass, 'bg-gray-50 text-gray-700 cursor-default')}>
              {initialContact.firstName} {initialContact.lastName}
            </div>
          </div>
        ) : (
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600">Link to Contact</label>
            <input
              value={resolvedContact ? `${resolvedContact.firstName} ${resolvedContact.lastName}` : contactSearch}
              onChange={(e) => { setContactSearch(e.target.value); setSelectedContact(null); doSearch('contact', e.target.value) }}
              placeholder="Search contacts…"
              className={inputClass}
            />
            {contactResults.length > 0 && !selectedContact && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {contactResults.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => { setSelectedContact(c); setContactResults([]) }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {c.firstName} {c.lastName} {c.email && <span className="text-gray-400">· {c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Company */}
        {initialCompany ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
            <div className={cn(inputClass, 'bg-gray-50 text-gray-700 cursor-default')}>
              {initialCompany.name}
            </div>
          </div>
        ) : (
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600">Link to Company</label>
            <input
              value={resolvedCompany ? resolvedCompany.name : companySearch}
              onChange={(e) => { setCompanySearch(e.target.value); setSelectedCompany(null); doSearch('company', e.target.value) }}
              placeholder="Search companies…"
              className={inputClass}
            />
            {companyResults.length > 0 && !selectedCompany && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {companyResults.map((c: any) => (
                  <button key={c.id} type="button"
                    onClick={() => { setSelectedCompany(c); setCompanyResults([]) }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
          <button type="button" onClick={handleClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={creating}
            className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
            {creating ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
