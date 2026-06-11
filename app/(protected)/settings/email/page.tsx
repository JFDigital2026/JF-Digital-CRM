'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Pencil, Check, X, Star } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  createdAt: string
}

type EmailSignature = {
  id: string
  name: string
  content: string
  isDefault: boolean
  createdAt: string
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'
const labelCls = 'mb-1 block text-[10px] font-bold tracking-widest text-[#415A77] uppercase'

// ─── Template Form ────────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<EmailTemplate>
  onSave: (data: { name: string; subject: string; body: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim() || !subject.trim()) { setError('Name and subject are required.'); return }
    setSaving(true)
    setError('')
    try { await onSave({ name, subject, body }) }
    catch { setError('Save failed. Try again.') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-[#415A77]/20 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>Template Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Follow-Up Email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Subject Line *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Following up on our conversation" className={inputCls} />
        </div>
      </div>
      <div className="mb-4">
        <label className={labelCls}>Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Write your email body here. HTML is supported."
          className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
        />
        <p className="mt-1 text-[10px] text-gray-400">HTML supported. Use {'{{firstName}}'}, {'{{lastName}}'}, {'{{companyName}}'} as merge tags.</p>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={saving}
          className="rounded-lg bg-[#415A77] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D1B2A] disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}

// ─── Signature Form ───────────────────────────────────────────────────────────

function SignatureForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<EmailSignature>
  onSave: (data: { name: string; content: string; isDefault: boolean }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try { await onSave({ name, content, isDefault }) }
    catch { setError('Save failed. Try again.') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-[#415A77]/20 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <label className={labelCls}>Signature Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Professional Signature" className={inputCls} />
      </div>
      <div className="mb-4">
        <label className={labelCls}>Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Your signature content. HTML is supported."
          className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
        />
        <p className="mt-1 text-[10px] text-gray-400">HTML supported. Use {'{{firstName}}'}, {'{{companyName}}'} as merge tags.</p>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <input type="checkbox" id="isDefault" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 accent-[#415A77]" />
        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer">Set as default signature</label>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={saving}
          className="rounded-lg bg-[#415A77] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D1B2A] disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Signature'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailSettingsPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [loadingT, setLoadingT] = useState(true)
  const [loadingS, setLoadingS] = useState(true)

  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null)
  const [showNewSig, setShowNewSig] = useState(false)
  const [editSig, setEditSig] = useState<EmailSignature | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoadingT(true)
    const r = await fetch('/api/email-templates')
    if (r.ok) setTemplates(await r.json())
    setLoadingT(false)
  }, [])

  const fetchSignatures = useCallback(async () => {
    setLoadingS(true)
    const r = await fetch('/api/email-signatures')
    if (r.ok) setSignatures(await r.json())
    setLoadingS(false)
  }, [])

  useEffect(() => { fetchTemplates(); fetchSignatures() }, [fetchTemplates, fetchSignatures])

  const createTemplate = async (data: { name: string; subject: string; body: string }) => {
    const r = await fetch('/api/email-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!r.ok) throw new Error()
    setShowNewTemplate(false)
    fetchTemplates()
  }

  const updateTemplate = async (id: string, data: { name: string; subject: string; body: string }) => {
    const r = await fetch(`/api/email-templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!r.ok) throw new Error()
    setEditTemplate(null)
    fetchTemplates()
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
    fetchTemplates()
  }

  const createSignature = async (data: { name: string; content: string; isDefault: boolean }) => {
    const r = await fetch('/api/email-signatures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!r.ok) throw new Error()
    setShowNewSig(false)
    fetchSignatures()
  }

  const updateSignature = async (id: string, data: { name: string; content: string; isDefault: boolean }) => {
    const r = await fetch(`/api/email-signatures/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!r.ok) throw new Error()
    setEditSig(null)
    fetchSignatures()
  }

  const deleteSignature = async (id: string) => {
    if (!confirm('Delete this signature?')) return
    await fetch(`/api/email-signatures/${id}`, { method: 'DELETE' })
    fetchSignatures()
  }

  const setDefaultSignature = async (id: string) => {
    await fetch(`/api/email-signatures/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isDefault: true }) })
    fetchSignatures()
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Email Settings" subtitle="Manage reusable templates and signatures." />

      {/* ── Templates ── */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Email Templates</p>
            <p className="mt-0.5 text-xs text-gray-500">Pre-written emails you can send or insert into outreach.</p>
          </div>
          {!showNewTemplate && (
            <button onClick={() => { setShowNewTemplate(true); setEditTemplate(null) }}
              className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#415A77] transition-colors">
              <Plus size={13} /> New Template
            </button>
          )}
        </div>

        {showNewTemplate && (
          <div className="mb-4">
            <TemplateForm onSave={createTemplate} onCancel={() => setShowNewTemplate(false)} />
          </div>
        )}

        {loadingT ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : templates.length === 0 && !showNewTemplate ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">No templates yet</p>
            <p className="mt-1 text-xs text-gray-400">Click New Template to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id}>
                {editTemplate?.id === t.id ? (
                  <TemplateForm initial={t} onSave={(data) => updateTemplate(t.id, data)} onCancel={() => setEditTemplate(null)} />
                ) : (
                  <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-[#415A77]/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500 truncate">Subject: {t.subject}</p>
                      {t.body && (
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2 font-mono">{t.body.replace(/<[^>]+>/g, ' ').trim()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditTemplate(t); setShowNewTemplate(false) }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#415A77]">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteTemplate(t.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Signatures ── */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Email Signatures</p>
            <p className="mt-0.5 text-xs text-gray-500">Appended automatically or inserted manually when composing.</p>
          </div>
          {!showNewSig && (
            <button onClick={() => { setShowNewSig(true); setEditSig(null) }}
              className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#415A77] transition-colors">
              <Plus size={13} /> New Signature
            </button>
          )}
        </div>

        {showNewSig && (
          <div className="mb-4">
            <SignatureForm onSave={createSignature} onCancel={() => setShowNewSig(false)} />
          </div>
        )}

        {loadingS ? (
          <div className="space-y-2">
            {[1].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : signatures.length === 0 && !showNewSig ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">No signatures yet</p>
            <p className="mt-1 text-xs text-gray-400">Click New Signature to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {signatures.map((s) => (
              <div key={s.id}>
                {editSig?.id === s.id ? (
                  <SignatureForm initial={s} onSave={(data) => updateSignature(s.id, data)} onCancel={() => setEditSig(null)} />
                ) : (
                  <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:border-[#415A77]/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        {s.isDefault && (
                          <span className="flex items-center gap-1 rounded-full bg-[#415A77]/10 px-2 py-0.5 text-[10px] font-bold text-[#415A77]">
                            <Star size={9} fill="currentColor" /> Default
                          </span>
                        )}
                      </div>
                      {s.content && (
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2 font-mono">{s.content.replace(/<[^>]+>/g, ' ').trim()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!s.isDefault && (
                        <button onClick={() => setDefaultSignature(s.id)} title="Set as default"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-[#415A77]/10 hover:text-[#415A77]">
                          <Star size={14} />
                        </button>
                      )}
                      <button onClick={() => { setEditSig(s); setShowNewSig(false) }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#415A77]">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteSignature(s.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
