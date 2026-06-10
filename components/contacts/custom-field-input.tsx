import React from 'react'
import { cn } from '@/lib/utils'

export interface CustomField {
  id: string
  name: string
  key: string
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT'
  options: string[]
}

interface CustomFieldInputProps {
  field: CustomField
  value: string
  onChange: (value: string) => void
  className?: string
}

const base =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

export function CustomFieldInput({ field, value, onChange, className }: CustomFieldInputProps) {
  if (field.type === 'BOOLEAN') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          type="checkbox"
          id={`cf-${field.id}`}
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor={`cf-${field.id}`} className="text-sm text-gray-700">
          {field.name}
        </label>
      </div>
    )
  }

  if (field.type === 'SELECT') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(base, className)}
      >
        <option value="">— Select —</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${field.name.toLowerCase()}`}
      className={cn(base, className)}
    />
  )
}
