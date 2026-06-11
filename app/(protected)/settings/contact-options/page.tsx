'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Save, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

type OptionItem = { value: string; label: string; color?: string }
type OptionList = { label: string; items: OptionItem[] }
type AllLists = Record<string, OptionList>

const COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6b7280',
  '#0891b2', '#be185d', '#65a30d', '#ea580c',
]

const fieldCls = 'rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

function toValue(label: string) {
  return label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
}

function ColorDot({ color, onClick }: { color?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-4 w-4 rounded-full shrink-0 border border-white shadow-sm ring-1 ring-gray-200"
      style={{ background: color || '#6b7280' }}
    />
  )
}

function OptionListEditor({
  listKey,
  list,
  onSave,
}: {
  listKey: string
  list: OptionList
  onSave: (key: string, updated: OptionList) => Promise<void>
}) {
  const [items, setItems] = useState<OptionItem[]>(list.items)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState(listKey === 'leadStatus')
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null)
  const [addColorPicker, setAddColorPicker] = useState(false)

  const mark = () => setDirty(true)

  const addItem = () => {
    if (!newLabel.trim()) return
    const value = toValue(newLabel.trim())
    if (items.find((i) => i.value === value)) return
    setItems((prev) => [...prev, { value, label: newLabel.trim(), color: newColor }])
    setNewLabel('')
    setNewColor(COLORS[items.length % COLORS.length])
    mark()
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
    mark()
  }

  const updateLabel = (idx: number, label: string) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, label } : item))
    mark()
  }

  const updateColor = (idx: number, color: string) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, color } : item))
    setShowColorPicker(null)
    mark()
  }

  const save = async () => {
    setSaving(true)
    await onSave(listKey, { label: list.label, items })
    setSaving(false)
    setDirty(false)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
          <span className="text-sm font-semibold text-gray-900">{list.label}</span>
          <span className="text-xs text-gray-400">{items.length} options</span>
        </div>
        {dirty && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-2 py-0.5">Unsaved</span>}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {/* Existing items */}
          <div className="space-y-1.5 mb-4">
            {items.map((item, idx) => (
              <div key={item.value} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
                <GripVertical size={13} className="text-gray-300 shrink-0" />
                <div className="relative">
                  <ColorDot color={item.color} onClick={() => setShowColorPicker(showColorPicker === idx ? null : idx)} />
                  {showColorPicker === idx && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(null)} />
                      <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-100 p-2.5 grid grid-cols-5 gap-1.5 min-w-[120px]">
                        {COLORS.map((c) => (
                          <button key={c} type="button" onClick={() => updateColor(idx, c)}
                            className="h-5 w-5 rounded-full border-2 hover:scale-110 transition-transform"
                            style={{ background: c, borderColor: item.color === c ? '#415A77' : 'transparent' }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <span className="text-xs font-mono text-gray-400 w-28 shrink-0 truncate">{item.value}</span>
                <input
                  value={item.label}
                  onChange={(e) => updateLabel(idx, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none focus:bg-white focus:border focus:border-[#415A77]/30 rounded px-1.5 py-0.5 transition-colors"
                />
                <button type="button" onClick={() => removeItem(idx)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add new option */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <ColorDot color={newColor} onClick={() => setAddColorPicker((p) => !p)} />
              {addColorPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddColorPicker(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-100 p-2.5 grid grid-cols-5 gap-1.5 min-w-[120px]">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => { setNewColor(c); setAddColorPicker(false) }}
                        className="h-5 w-5 rounded-full border-2 hover:scale-110 transition-transform"
                        style={{ background: c, borderColor: newColor === c ? '#415A77' : 'transparent' }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
              placeholder="Add option…"
              className={`flex-1 ${fieldCls}`}
            />
            <button type="button" onClick={addItem}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors shrink-0">
              <Plus size={13} /> Add
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ContactOptionsPage() {
  const [lists, setLists] = useState<AllLists | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/option-lists')
      .then((r) => r.json())
      .then((d) => { setLists(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async (key: string, updated: OptionList) => {
    await fetch(`/api/option-lists/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setLists((prev) => prev ? { ...prev, [key]: updated } : prev)
  }

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Contact Options"
        subtitle="Configure the dropdown choices available on contact profiles."
      />

      <div className="mt-6">
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">How this works</p>
          <p className="mt-1 text-xs text-blue-600">
            Changes here update the available options on every contact&apos;s profile immediately.
            Existing contacts keep their current value even if that option is removed.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : lists ? (
          <div className="space-y-3">
            {Object.entries(lists).map(([key, list]) => (
              <OptionListEditor key={key} listKey={key} list={list} onSave={handleSave} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Failed to load options.</p>
        )}
      </div>
    </div>
  )
}
