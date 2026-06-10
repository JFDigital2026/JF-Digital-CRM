'use client'

import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { TaskTemplatesPanel } from '@/components/tasks/task-templates-panel'

type DefaultView = 'table' | 'kanban'
type DefaultFilter = 'all' | 'mine' | 'today' | 'overdue'

const VIEW_OPTIONS: { value: DefaultView; label: string; description: string }[] = [
  { value: 'table', label: 'Table', description: 'Rows with sortable columns and bulk actions.' },
  { value: 'kanban', label: 'Kanban', description: 'Drag-and-drop cards organized by status.' },
]

const FILTER_OPTIONS: { value: DefaultFilter; label: string }[] = [
  { value: 'all', label: 'All Tasks' },
  { value: 'mine', label: 'My Tasks' },
  { value: 'today', label: 'Due Today' },
  { value: 'overdue', label: 'Overdue' },
]

export default function TaskSettingsPage() {
  const [defaultView, setDefaultView] = useState<DefaultView>('table')
  const [defaultFilter, setDefaultFilter] = useState<DefaultFilter>('all')
  const [showTemplates, setShowTemplates] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const storedView = localStorage.getItem('tasks-default-view') as DefaultView | null
    const storedFilter = localStorage.getItem('tasks-default-filter') as DefaultFilter | null
    if (storedView) setDefaultView(storedView)
    if (storedFilter) setDefaultFilter(storedFilter)
  }, [])

  const handleSave = () => {
    localStorage.setItem('tasks-default-view', defaultView)
    localStorage.setItem('tasks-default-filter', defaultFilter)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClass =
    'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20 transition-colors'

  return (
    <div className="px-6 py-6 max-w-2xl">
      <PageHeader title="Task Settings" subtitle="Configure default behaviors for the Tasks module." />

      <div className="space-y-8">
        {/* Default View */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Default View</h2>
          <p className="text-xs text-gray-500 mb-4">Choose how tasks are displayed when you first open the Tasks page.</p>
          <div className="space-y-2">
            {VIEW_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name="defaultView"
                  value={opt.value}
                  checked={defaultView === opt.value}
                  onChange={() => setDefaultView(opt.value)}
                  className="mt-0.5 accent-[#0D1B2A]"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Default Filter */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Default Filter</h2>
          <p className="text-xs text-gray-500 mb-4">Which tasks tab should be active by default.</p>
          <select
            value={defaultFilter}
            onChange={(e) => setDefaultFilter(e.target.value as DefaultFilter)}
            className={inputClass}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </section>

        {/* Templates */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Task Templates</h2>
          <p className="text-xs text-gray-500 mb-4">
            Create reusable sets of tasks you can apply to contacts, companies, or projects.
          </p>
          <button
            onClick={() => setShowTemplates(true)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Manage Templates
          </button>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-[#0D1B2A] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#1B263B] transition-colors"
          >
            Save Preferences
          </button>
          {saved && (
            <p className="text-sm text-emerald-600 font-medium">Saved!</p>
          )}
        </div>
      </div>

      <TaskTemplatesPanel open={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  )
}
