'use client'

import React, { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

const CONTACT_FIELDS = [
  { value: '__skip__', label: '— Skip —' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'title', label: 'Title' },
  { value: 'role', label: 'Role' },
  { value: 'source', label: 'Source' },
  { value: 'tags', label: 'Tags (comma-separated)' },
  { value: 'notes', label: 'Notes' },
]

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const vals = parseCSVLine(line)
    return headers.reduce((acc, h, i) => ({ ...acc, [h]: vals[i] ?? '' }), {} as Record<string, string>)
  })
  return { headers, rows }
}

interface CSVImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CSVImportModal({ open, onClose, onSuccess }: CSVImportModalProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setResult(null)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      // Auto-map by name similarity
      const autoMap: Record<string, string> = {}
      parsed.headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/\s/g, '')
        const match = CONTACT_FIELDS.find(
          (f) => f.value !== '__skip__' && f.value.toLowerCase() === lower
        )
        autoMap[h] = match?.value ?? '__skip__'
      })
      setMapping(autoMap)
      setStep('map')
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    const mapped = rows.map((row) => {
      const out: Record<string, string> = {}
      headers.forEach((h) => {
        const field = mapping[h]
        if (field && field !== '__skip__' && row[h] !== undefined) {
          out[field] = row[h]
        }
      })
      return out
    })

    const res = await fetch('/api/contacts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: mapped }),
    })
    const data = await res.json()
    setResult(data)
    setStep('done')
    setImporting(false)
    if (data.created > 0) onSuccess()
  }

  const dropZone = (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-all',
        isDragging ? 'border-[#415A77] bg-[#415A77]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <Upload size={24} className="text-gray-400" />
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">Drop CSV file here or <span className="text-[#415A77]">browse</span></p>
        <p className="mt-0.5 text-xs text-gray-400">First row must be column headers</p>
      </div>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />
    </div>
  )

  const mapStep = (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">{rows.length} rows found. Map CSV columns to contact fields:</p>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CSV Column</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Maps To</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h) => (
              <tr key={h} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2 text-gray-700">{h}</td>
                <td className="px-3 py-2">
                  <select
                    value={mapping[h] ?? '__skip__'}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]"
                  >
                    {CONTACT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview */}
      <div>
        <p className="mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview (first 5 rows)</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {headers
                  .filter((h) => mapping[h] && mapping[h] !== '__skip__')
                  .map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500">{CONTACT_FIELDS.find(f => f.value === mapping[h])?.label ?? h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  {headers
                    .filter((h) => mapping[h] && mapping[h] !== '__skip__')
                    .map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{row[h]}</td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50"
        >
          {importing ? 'Importing…' : `Import ${rows.length} Contacts`}
        </button>
      </div>
    </div>
  )

  const doneStep = result && (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      {result.created > 0 ? (
        <CheckCircle size={40} className="text-emerald-500" />
      ) : (
        <AlertCircle size={40} className="text-red-400" />
      )}
      <div>
        <p className="text-lg font-semibold text-gray-900">{result.created} contacts imported</p>
        {result.errors.length > 0 && (
          <p className="mt-1 text-sm text-red-500">{result.errors.length} rows had errors</p>
        )}
      </div>
      {result.errors.length > 0 && (
        <div className="w-full max-h-32 overflow-y-auto rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left">
          {result.errors.map((e: any, i: number) => (
            <p key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</p>
          ))}
        </div>
      )}
      <button
        onClick={() => { reset(); onClose() }}
        className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
      >
        Done
      </button>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Import Contacts from CSV"
      size="lg"
    >
      {step === 'upload' && dropZone}
      {step === 'map' && mapStep}
      {step === 'done' && doneStep}
    </Modal>
  )
}
