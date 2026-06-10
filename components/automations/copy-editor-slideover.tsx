'use client'

import { useState, useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import type { AutomationStep } from '@/lib/automation-types'
import { STEP_BORDER_COLORS, STEP_LABELS } from '@/lib/automation-types'
import { cn } from '@/lib/utils'

const MERGE_TAGS = [
  { label: '{{contact.firstName}}', display: 'First Name' },
  { label: '{{contact.lastName}}',  display: 'Last Name' },
  { label: '{{contact.email}}',     display: 'Email' },
  { label: '{{contact.phone}}',     display: 'Phone' },
  { label: '{{contact.company}}',   display: 'Company' },
]

// ─── Tiptap toolbar ───────────────────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null
  const btn = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
        active ? 'bg-[#0D1B2A] text-white' : 'text-gray-500 hover:bg-gray-100'
      )}
    >
      {children}
    </button>
  )
  return (
    <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <strong>B</strong>)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <em>I</em>)}
      <div className="w-px h-4 bg-gray-200 mx-1" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), '• ≡')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1 ≡')}
      <div className="w-px h-4 bg-gray-200 mx-1" />
      {btn(
        editor.isActive('link'),
        () => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
          } else {
            const url = window.prompt('URL')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }
        },
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )}
    </div>
  )
}

// ─── Read-only info panel ─────────────────────────────────────────────────────

function ReadOnlyPanel({ step }: { step: AutomationStep }) {
  const cfg = step.config as Record<string, unknown>
  return (
    <div className="p-5 space-y-3">
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-widest">Configuration</p>
        {Object.entries(cfg).map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
            <span className="text-xs text-gray-400 w-24 shrink-0 font-mono">{k}</span>
            <span className="text-xs text-gray-700 break-all">{JSON.stringify(v)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 italic text-center">
        Structure changes must be made in Claude Code by editing the .json file.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CopyEditorSlideOverProps {
  step: AutomationStep
  automationId: string
  overrides?: Record<string, string>
  onClose: () => void
  onSaved: (stepId: string, fields: Record<string, string>) => void
}

export function CopyEditorSlideOver({ step, automationId, overrides, onClose, onSaved }: CopyEditorSlideOverProps) {
  const color = (STEP_BORDER_COLORS as Record<string, string>)[step.type] ?? '#9CA3AF'
  const typeLabel = (STEP_LABELS as Record<string, string>)[step.type] ?? step.type
  const cfg = step.config as Record<string, unknown>

  const isEditable = ['EMAIL', 'SMS', 'TASK'].includes(step.type)

  // EMAIL fields
  const [subject, setSubject] = useState<string>((overrides?.subject ?? String(cfg.subject ?? '')))
  const [smsBody, setSmsBody] = useState<string>((overrides?.body ?? String(cfg.body ?? '')))
  const [taskTitle, setTaskTitle] = useState<string>((overrides?.title ?? String(cfg.title ?? '')))
  const [taskDesc, setTaskDesc] = useState<string>((overrides?.description ?? String(cfg.description ?? '')))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Active textarea ref for SMS/TASK merge tag insertion
  const smsRef = useRef<HTMLTextAreaElement>(null)
  const taskTitleRef = useRef<HTMLInputElement>(null)
  const taskDescRef = useRef<HTMLTextAreaElement>(null)
  const [activeRef, setActiveRef] = useState<'smsBody' | 'taskTitle' | 'taskDesc' | null>(null)

  // Tiptap for EMAIL body
  const initialBody = overrides?.body ?? String(cfg.body ?? '')
  const bodyEditor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: initialBody,
  })

  const insertMergeTag = (tag: string) => {
    if (step.type === 'EMAIL') {
      bodyEditor?.chain().focus().insertContent(tag).run()
    } else if (step.type === 'SMS') {
      const el = smsRef.current
      if (!el) return
      const start = el.selectionStart ?? smsBody.length
      const end = el.selectionEnd ?? smsBody.length
      setSmsBody(smsBody.slice(0, start) + tag + smsBody.slice(end))
    } else if (step.type === 'TASK') {
      if (activeRef === 'taskTitle') {
        const el = taskTitleRef.current
        if (!el) return
        const start = el.selectionStart ?? taskTitle.length
        const end = el.selectionEnd ?? taskTitle.length
        setTaskTitle(taskTitle.slice(0, start) + tag + taskTitle.slice(end))
      } else {
        const el = taskDescRef.current
        if (!el) return
        const start = el.selectionStart ?? taskDesc.length
        const end = el.selectionEnd ?? taskDesc.length
        setTaskDesc(taskDesc.slice(0, start) + tag + taskDesc.slice(end))
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    let fields: Record<string, string> = {}

    if (step.type === 'EMAIL') {
      const htmlBody = bodyEditor?.getHTML() ?? ''
      fields = { subject, body: htmlBody }
    } else if (step.type === 'SMS') {
      fields = { body: smsBody }
    } else if (step.type === 'TASK') {
      fields = { title: taskTitle, description: taskDesc }
    }

    try {
      const res = await fetch(`/api/automations/${automationId}/copy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: step.id, fields }),
      })
      if (res.ok) {
        setSaved(true)
        onSaved(step.id, fields)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* SlideOver */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase"
                  style={{ color, backgroundColor: `${color}15` }}
                >
                  {typeLabel}
                </span>
              </div>
              {isEditable ? (
                <p className="text-xs text-gray-400">Copy edits saved to DB — not written back to .json file</p>
              ) : (
                <p className="text-xs text-amber-600">Read-only — edit in Claude Code</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Note about structure */}
        {isEditable && (
          <div className="mx-5 mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Structure changes</span> (step type, order, wait durations) must be made in Claude Code by editing the <code className="font-mono bg-amber-100 px-1 rounded">.json</code> file in <code className="font-mono bg-amber-100 px-1 rounded">/automations/</code>.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!isEditable ? (
            <ReadOnlyPanel step={step} />
          ) : step.type === 'EMAIL' ? (
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Subject line</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#415A77]/30"
                  placeholder="Email subject..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Body</label>
                <div className="rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#415A77]/30">
                  <EditorToolbar editor={bodyEditor} />
                  <EditorContent
                    editor={bodyEditor}
                    className="prose prose-sm max-w-none p-3 min-h-[180px] text-gray-800 focus:outline-none"
                  />
                </div>
              </div>
              {/* Merge tags */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Insert merge tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_TAGS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => insertMergeTag(t.label)}
                      className="px-2 py-1 rounded-full bg-[#415A77]/8 border border-[#415A77]/15 text-[11px] text-[#415A77] font-medium hover:bg-[#415A77]/15 transition-colors"
                    >
                      {t.display}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : step.type === 'SMS' ? (
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-700">Message body</label>
                  <span className={cn('text-xs', smsBody.length > 160 ? 'text-red-500 font-semibold' : 'text-gray-400')}>
                    {smsBody.length}/160
                  </span>
                </div>
                <textarea
                  ref={smsRef}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  onFocus={() => setActiveRef('smsBody')}
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#415A77]/30 resize-none"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Insert merge tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_TAGS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => insertMergeTag(t.label)}
                      className="px-2 py-1 rounded-full bg-[#415A77]/8 border border-[#415A77]/15 text-[11px] text-[#415A77] font-medium hover:bg-[#415A77]/15 transition-colors"
                    >
                      {t.display}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : step.type === 'TASK' ? (
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  ref={taskTitleRef}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onFocus={() => setActiveRef('taskTitle')}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#415A77]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  ref={taskDescRef}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  onFocus={() => setActiveRef('taskDesc')}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#415A77]/30 resize-none"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Insert merge tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_TAGS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => insertMergeTag(t.label)}
                      className="px-2 py-1 rounded-full bg-[#415A77]/8 border border-[#415A77]/15 text-[11px] text-[#415A77] font-medium hover:bg-[#415A77]/15 transition-colors"
                    >
                      {t.display}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {isEditable && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 bg-gray-50/50">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all',
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#0D1B2A] text-white hover:bg-[#1a2d42]',
                saving && 'opacity-60 cursor-not-allowed'
              )}
            >
              {saved ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : saving ? 'Saving…' : 'Save Copy'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
