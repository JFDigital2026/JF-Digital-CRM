'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface InlineFieldProps {
  label: string
  value?: string | null
  onSave: (value: string) => void
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select'
  options?: string[]
  placeholder?: string
  className?: string
}

export function InlineField({
  label,
  value,
  onSave,
  type = 'text',
  options,
  placeholder = 'Click to edit…',
  className,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value ?? '')

  useEffect(() => {
    setLocal(value ?? '')
  }, [value])

  const commit = () => {
    setEditing(false)
    if (local !== (value ?? '')) onSave(local)
  }

  const inputClass =
    'w-full rounded-md border border-[#415A77] bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#415A77]/20'

  return (
    <div className={cn(className)}>
      <p className="mb-0.5 text-xs font-medium text-gray-500">{label}</p>
      {editing ? (
        type === 'textarea' ? (
          <textarea
            autoFocus
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            rows={4}
            className={cn(inputClass, 'resize-none')}
          />
        ) : type === 'select' && options ? (
          <select
            autoFocus
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={type}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setLocal(value ?? '')
                setEditing(false)
              }
            }}
            className={inputClass}
          />
        )
      ) : (
        <div
          onClick={() => setEditing(true)}
          className={cn(
            'cursor-text rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-50',
            local ? 'text-gray-900' : 'italic text-gray-400'
          )}
        >
          {local || placeholder}
        </div>
      )}
    </div>
  )
}
