'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'] as const
type FieldType = typeof FIELD_TYPES[number]

const TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Text', NUMBER: 'Number', DATE: 'Date', BOOLEAN: 'Yes/No', SELECT: 'Dropdown (Select)',
}
const TYPE_DESC: Record<FieldType, string> = {
  TEXT: 'Single-line text input',
  NUMBER: 'Numeric value',
  DATE: 'Date picker',
  BOOLEAN: 'Checkbox (true/false)',
  SELECT: 'Pick from a list of options',
}

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

interface CustomField {
  id: string
  name: string
  key: string
  type: FieldType
  options: string[]
  createdAt: string
}

function toKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<FieldType>('TEXT')
  const [newOptions, setNewOptions] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOptions, setEditOptions] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchFields = async () => {
    setLoading(true)
    const res = await fetch('/api/custom-fields')
    const data = await res.json()
    setFields(data)
    setLoading(false)
  }

  useEffect(() => { fetchFields() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) { setCreateError('Name required'); return }
    setCreating(true); setCreateError('')
    try {
      const options = newType === 'SELECT'
        ? newOptions.split(',').map(s => s.trim()).filter(Boolean)
        : []
      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), key: toKey(newName.trim()), type: newType, options }),
      })
      if (!res.ok) throw new Error(await res.text())
      setNewName(''); setNewType('TEXT'); setNewOptions(''); setShowCreate(false)
      fetchFields()
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (field: CustomField) => { setEditId(field.id); setEditName(field.name); setEditOptions(field.options.join(', ')) }
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditOptions('') }

  const saveEdit = async (field: CustomField) => {
    setSaving(true)
    const options = field.type === 'SELECT'
      ? editOptions.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    await fetch(`/api/custom-fields/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), ...(options !== undefined && { options }) }),
    })
    setSaving(false); cancelEdit(); fetchFields()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/custom-fields/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null); fetchFields()
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Custom Fields"
        subtitle="Add extra fields that appear on contact profiles and forms."
        actions={
          <button
            onClick={() => setShowCreate((p) => !p)}
            className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
          >
            <Plus size={15} /> Add Field
          </button>
        }
      />

      {/* What are custom fields? */}
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-blue-700">What are custom fields?</p>
        <p className="mt-1 text-xs text-blue-600">
          Custom fields let you track extra information on contacts — things like LinkedIn URL, Lead Score, Account Type, or any detail specific to your workflow.
          Fields you create here appear in the contact form and on every contact profile.
        </p>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-5 rounded-xl border border-[#415A77]/30 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-700">New Custom Field</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Field Name *</label>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. LinkedIn URL" className={inputClass} />
              {newName && <p className="mt-1 text-[10px] text-gray-400">Key: {toKey(newName)}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Field Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} className={inputClass}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-gray-400">{TYPE_DESC[newType]}</p>
            </div>
            {newType === 'SELECT' && (
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Options (comma-separated)</label>
                <input value={newOptions} onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="Option A, Option B, Option C" className={inputClass} />
              </div>
            )}
          </div>
          {createError && <p className="mt-2 text-sm text-red-500">{createError}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button type="submit" disabled={creating}
              className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
              {creating ? 'Creating…' : 'Create Field'}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setCreateError('') }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Fields list */}
      <div>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
          </div>
        ) : fields.length === 0 ? (
          <EmptyState
            title="No custom fields yet"
            description="Click 'Add Field' to create your first custom field."
          />
        ) : (
          <div className="space-y-2">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <GripVertical size={14} className="shrink-0 text-gray-300" />
                {editId === field.id ? (
                  <div className="flex flex-1 items-center gap-3">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-md border border-[#415A77] px-2 py-1.5 text-sm outline-none" />
                    {field.type === 'SELECT' && (
                      <input value={editOptions} onChange={(e) => setEditOptions(e.target.value)}
                        placeholder="Options (comma-separated)"
                        className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#415A77]" />
                    )}
                    <button onClick={() => saveEdit(field)} disabled={saving}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEdit}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-50 text-gray-500 hover:bg-gray-100">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 cursor-pointer" onClick={() => startEdit(field)}>
                      <p className="text-sm font-medium text-gray-900">{field.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">{field.key}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {TYPE_LABELS[field.type]}
                        </span>
                        {field.type === 'SELECT' && field.options.length > 0 && (
                          <span className="text-xs text-gray-400">{field.options.join(' · ')}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setDeleteId(field.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Custom Field"
        description="All values for this field will be permanently deleted across all contacts. This cannot be undone."
        destructive
      />
    </div>
  )
}
