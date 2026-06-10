'use client'

import React, { useState, useEffect } from 'react'
import { Copy, Check, Plus, Trash2, Edit2, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

// ─── Built-in reference tags ────────────────────────────────────────────────

const CONTACT_TAGS = [
  { tag: '{{firstName}}', description: "Contact's first name", example: 'Jace' },
  { tag: '{{lastName}}', description: "Contact's last name", example: 'Freeman' },
  { tag: '{{fullName}}', description: 'Full name', example: 'Jace Freeman' },
  { tag: '{{email}}', description: 'Email address', example: 'jace@example.com' },
  { tag: '{{phone}}', description: 'Phone number', example: '+1 555-123-4567' },
  { tag: '{{title}}', description: 'Job title', example: 'CEO' },
  { tag: '{{leadStatus}}', description: 'Current lead status', example: 'Active' },
]
const COMPANY_TAGS = [
  { tag: '{{companyName}}', description: 'Company name', example: 'Acme Corp' },
  { tag: '{{website}}', description: 'Company website', example: 'acme.com' },
  { tag: '{{industry}}', description: 'Industry', example: 'SaaS' },
  { tag: '{{city}}', description: 'City', example: 'Austin' },
  { tag: '{{state}}', description: 'State', example: 'TX' },
]
const SYSTEM_TAGS = [
  { tag: '{{today}}', description: "Today's date", example: 'June 7, 2026' },
  { tag: '{{senderName}}', description: 'Your name', example: 'Your Name' },
  { tag: '{{senderEmail}}', description: 'Your email', example: 'you@company.com' },
]

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

function toKey(name: string) {
  return name
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^./, (c) => c.toLowerCase())
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  )
}

// ─── Reference tag row ───────────────────────────────────────────────────────

function RefTagRow({ tag, description, example }: { tag: string; description: string; example: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-white px-4 py-2.5 hover:bg-gray-50">
      <code className="w-40 shrink-0 rounded-md bg-[#0D1B2A]/5 px-2 py-1 text-xs font-mono font-semibold text-[#0D1B2A]">{tag}</code>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{description}</p>
        <p className="text-xs text-gray-400">e.g. {example}</p>
      </div>
      <CopyBtn text={tag} />
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

interface CustomValue {
  id: string
  name: string
  key: string
  value: string
}

export default function CustomValuesPage() {
  const [customValues, setCustomValues] = useState<CustomValue[]>([])
  const [loading, setLoading] = useState(true)

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [keyManual, setKeyManual] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchValues = async () => {
    setLoading(true)
    const res = await fetch('/api/custom-values')
    const data = res.ok ? await res.json() : []
    setCustomValues(data)
    setLoading(false)
  }

  useEffect(() => { fetchValues() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newValue.trim()) { setCreateError('Name and value are required'); return }
    setCreating(true); setCreateError('')
    const res = await fetch('/api/custom-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), key: newKey || toKey(newName.trim()), value: newValue.trim() }),
    })
    if (!res.ok) { setCreateError('Key already exists — try a different name'); setCreating(false); return }
    setNewName(''); setNewKey(''); setNewValue(''); setKeyManual(false)
    setShowCreate(false); setCreating(false)
    fetchValues()
  }

  const handleSaveEdit = async (id: string) => {
    await fetch(`/api/custom-values/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), value: editValue }),
    })
    setEditId(null)
    fetchValues()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/custom-values/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    fetchValues()
  }

  const customTag = (key: string) => `{{${key}}}`

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Custom Values"
        subtitle="Merge tags for mass outreach and templates."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
          >
            <Plus size={15} /> Add Custom Value
          </button>
        }
      />

      <div className="mb-5 mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-blue-700">How merge tags work</p>
        <p className="mt-1 text-xs text-blue-600">
          Paste any tag into a message template. When sending, it auto-replaces with the real value.
          E.g. <code className="font-mono">{'{{firstName}}'}</code> → "Jace"
          or your custom <code className="font-mono">{'{{calendlyLink}}'}</code> → your Calendly URL.
        </p>
      </div>

      {/* ─── Custom Values (user-defined) ─────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Your Custom Values</h2>
            <p className="text-xs text-gray-500">Values you define — like calendar links, offer names, phone numbers.</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">{[1,2].map(i => <div key={i} className="h-12 rounded-lg bg-gray-100" />)}</div>
        ) : customValues.length === 0 ? (
          <EmptyState title="No custom values yet" description="Click 'Add Custom Value' to create one." />
        ) : (
          <div className="space-y-1.5">
            {customValues.map((cv) => (
              <div key={cv.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-2.5">
                <code className="w-40 shrink-0 rounded-md bg-[#0D1B2A]/5 px-2 py-1 text-xs font-mono font-semibold text-[#0D1B2A]">
                  {customTag(cv.key)}
                </code>
                {editId === cv.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      placeholder="Display name" className="flex-1 rounded-md border border-[#415A77] px-2 py-1.5 text-sm outline-none" />
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Value" className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#415A77]" />
                    <button onClick={() => handleSaveEdit(cv.id)} className="rounded-md bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B263B]">Save</button>
                    <button onClick={() => setEditId(null)} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{cv.name}</p>
                      <p className="text-xs text-gray-400 truncate">{cv.value}</p>
                    </div>
                    <CopyBtn text={customTag(cv.key)} />
                    <button onClick={() => { setEditId(cv.id); setEditName(cv.name); setEditValue(cv.value) }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 hover:bg-gray-100 hover:text-gray-600">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteId(cv.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Built-in reference tags ───────────────────────────────────── */}
      {[
        { title: 'Contact Fields', description: 'Auto-fills from the contact profile.', tags: CONTACT_TAGS },
        { title: 'Company Fields', description: "Auto-fills from the contact's linked company.", tags: COMPANY_TAGS },
        { title: 'System Values', description: 'Auto-generated at time of sending.', tags: SYSTEM_TAGS },
      ].map(({ title, description, tags }) => (
        <div key={title} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="mb-2 text-xs text-gray-500">{description}</p>
          <div className="space-y-1.5">
            {tags.map((t) => <RefTagRow key={t.tag} {...t} />)}
          </div>
        </div>
      ))}

      {/* ─── Create modal ──────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError('') }} title="Add Custom Value" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Display Name *</label>
            <input autoFocus value={newName}
              onChange={(e) => { setNewName(e.target.value); if (!keyManual) setNewKey(toKey(e.target.value)) }}
              placeholder="e.g. My Calendly Link" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Merge Tag Key</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400 font-mono">{'{{'}  </span>
              <input value={newKey || toKey(newName)}
                onChange={(e) => { setNewKey(e.target.value); setKeyManual(true) }}
                placeholder="calendlyLink" className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-[#415A77]" />
              <span className="text-sm text-gray-400 font-mono">  {'}}'}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-gray-400">Use in templates as <code>{`{{${newKey || toKey(newName)}}}`}</code></p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Value *</label>
            <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
              placeholder="e.g. https://calendly.com/yourname" className={inputClass} />
          </div>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={creating} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Custom Value"
        description="This will remove this merge tag. Any templates using it will no longer auto-fill."
        destructive
      />
    </div>
  )
}
