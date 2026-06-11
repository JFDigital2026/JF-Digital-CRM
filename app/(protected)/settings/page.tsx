'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Settings2, Tag, Key, Webhook, ChevronRight,
  Kanban, Calendar, Sliders, Database, Mail,
  Users as UsersIcon, Plus, MoreHorizontal, Shield,
  CheckCircle2, XCircle, Clock, RefreshCw, Lock,
  Eye, EyeOff, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { TabGroup } from '@/components/ui/tab-group'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { format, formatDistanceToNow } from 'date-fns'
import { ROLE_PRESETS, getPresetForRole, type PermissionsJson } from '@/lib/rolePresets'
import { SlideOver } from '@/components/ui/slide-over'

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRecord = {
  id: string
  firstName: string
  lastName: string
  name?: string | null
  email: string
  role: string
  department?: string | null
  title?: string | null
  active: boolean
  permissions: Record<string, any>
  createdAt: string
  lastLoginAt?: string | null
  avatarUrl?: string | null
  createdByUser?: { firstName: string; lastName: string; name?: string | null } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ADMIN:     'bg-[#0D1B2A] text-white',
  MANAGER:   'bg-[#1B263B] text-white',
  SALES_REP: 'bg-[#415A77] text-white',
  SUPPORT:   'bg-[#778DA9] text-white',
  CUSTOM:    'bg-gray-200 text-gray-700',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', SALES_REP: 'Sales Rep',
  SUPPORT: 'Support', CUSTOM: 'Custom',
}

const DEPARTMENTS = ['Sales', 'Support', 'Operations', 'Marketing', 'Management']

const PERMISSION_MODULES = [
  { key: 'dashboard',    label: 'Dashboard',    actions: ['view'] },
  { key: 'contacts',     label: 'Contacts',     actions: ['view','create','edit','delete','import','export'] },
  { key: 'companies',    label: 'Companies',    actions: ['view','create','edit','delete'] },
  { key: 'pipelines',    label: 'Pipelines',    actions: ['view','create','edit','delete','managePipelines'] },
  { key: 'calendar',     label: 'Calendar',     actions: ['view','create','edit','delete','manageSettings'] },
  { key: 'inbox',        label: 'Inbox',        actions: ['view','reply'] },
  { key: 'tasks',        label: 'Tasks',        actions: ['view','create','edit','delete'] },
  { key: 'products',     label: 'Products',     actions: ['view','create','edit','delete'] },
  { key: 'automations',  label: 'Automations',  actions: ['view','test','toggleActive'] },
  { key: 'metrics',      label: 'Metrics',      actions: ['view','export'] },
  { key: 'aiAssistant',  label: 'AI Assistant', actions: ['view'] },
  { key: 'settings',     label: 'Settings',     actions: ['view','manageUsers','manageApi','manageIntegrations','manageCustomFields'] },
]

const ACTION_LABELS: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  import: 'Import', export: 'Export', reply: 'Reply', test: 'Test',
  toggleActive: 'Toggle', managePipelines: 'Manage', manageSettings: 'Settings',
  manageUsers: 'Users', manageApi: 'API', manageIntegrations: 'Integrations',
  manageCustomFields: 'Custom Fields',
}

const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors'

// ─── Settings sections (existing) ────────────────────────────────────────────

type SettingsSection = { href: string; icon: React.ElementType; title: string; description: string; external?: boolean }
type SettingsCategory = { label: string; sections: SettingsSection[] }

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    label: 'CRM Configuration',
    sections: [
      { href: '/pipeline', icon: Kanban, title: 'Pipelines', description: 'Manage your sales pipelines and stages.', external: true },
      { href: '/calendar', icon: Calendar, title: 'Calendars', description: 'Configure booking calendars and availability.', external: true },
      { href: '/settings/contact-options', icon: Sliders, title: 'Contact Options', description: 'Customize dropdown choices for contact fields.' },
      { href: '/settings/custom-fields', icon: Database, title: 'Custom Fields', description: 'Add extra fields to contact profiles.' },
      { href: '/settings/custom-values', icon: Tag, title: 'Custom Values', description: 'Manage merge tags for templates and outreach.' },
      { href: '/settings/email', icon: Mail, title: 'Email', description: 'Create reusable email templates and signatures.' },
    ],
  },
  {
    label: 'Developer & Integrations',
    sections: [
      { href: '/settings/api', icon: Key, title: 'API Keys', description: 'Create and manage Bearer token API keys.' },
      { href: '/settings/webhooks', icon: Webhook, title: 'Webhooks', description: 'Configure outbound webhook endpoints.' },
    ],
  },
]

// ─── Permission Accordion ─────────────────────────────────────────────────────

function PermissionsAccordion({
  permissions,
  onChange,
}: {
  permissions: Record<string, any>
  onChange: (p: Record<string, any>) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    const s = new Set(open)
    s.has(key) ? s.delete(key) : s.add(key)
    setOpen(s)
  }

  function setAction(module: string, action: string, val: boolean) {
    const updated = {
      ...permissions,
      [module]: { ...(permissions[module] ?? {}), [action]: val },
    }
    onChange(updated)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {PERMISSION_MODULES.map((mod) => {
        const isOpen = open.has(mod.key)
        const modPerms = permissions[mod.key] ?? {}
        const activeCount = mod.actions.filter((a) => modPerms[a]).length
        return (
          <div key={mod.key} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(mod.key)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">{mod.label}</span>
                <span className="rounded-full bg-[#415A77]/10 text-[#415A77] px-1.5 py-0.5 text-[10px] font-bold">
                  {activeCount}/{mod.actions.length}
                </span>
              </div>
              {isOpen ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 border-t border-gray-50 pt-2 flex flex-wrap gap-2">
                {mod.actions.map((action) => (
                  <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modPerms[action] === true}
                      onChange={(e) => setAction(mod.key, action, e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#415A77]"
                    />
                    <span className="text-xs text-gray-600">{ACTION_LABELS[action] ?? action}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Role Card Selector ───────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, string> = {
  MANAGER: 'Full access except user management and admin settings.',
  SALES_REP: 'Can manage contacts, companies, pipeline, and tasks.',
  SUPPORT: 'View and edit contacts, handle tasks and inbox.',
  CUSTOM: 'Start with Sales Rep defaults — customize each permission.',
}

function RoleSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (r: string) => void
}) {
  const roles = ['MANAGER', 'SALES_REP', 'SUPPORT', 'CUSTOM']
  return (
    <div className="grid grid-cols-2 gap-2">
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`relative flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all ${
            value === r
              ? 'border-[#415A77] bg-[#415A77]/5'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          {value === r && (
            <CheckCircle2 size={14} className="absolute top-2 right-2 text-[#415A77]" />
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold mb-1 ${ROLE_COLORS[r]}`}>
            {ROLE_LABELS[r]}
          </span>
          <span className="text-xs text-gray-500 leading-snug">{ROLE_DESCRIPTIONS[r]}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Password Strength ────────────────────────────────────────────────────────

function getPasswordStrength(pwd: string): { label: string; color: string; score: number } {
  if (pwd.length < 6) return { label: 'Too short', color: 'bg-red-400', score: 0 }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { label: 'Weak', color: 'bg-red-400', score: 1 }
  if (score === 2) return { label: 'Fair', color: 'bg-yellow-400', score: 2 }
  if (score === 3) return { label: 'Strong', color: 'bg-blue-400', score: 3 }
  return { label: 'Very Strong', color: 'bg-emerald-400', score: 4 }
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({ open, onClose, onSuccess, currentUserId }: {
  open: boolean; onClose: () => void; onSuccess: () => void; currentUserId: string
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('SALES_REP')
  const [department, setDepartment] = useState('')
  const [title, setTitle] = useState('')
  const [permissions, setPermissions] = useState<Record<string, any>>(getPresetForRole('SALES_REP'))
  const [showCustomPerms, setShowCustomPerms] = useState(false)
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)
  const [emailChecking, setEmailChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setConfirmPassword('')
    setRole('SALES_REP'); setDepartment(''); setTitle('')
    setPermissions(getPresetForRole('SALES_REP')); setShowCustomPerms(false)
    setEmailAvailable(null); setError(''); setSaving(false)
  }

  useEffect(() => { if (!open) reset() }, [open])

  useEffect(() => {
    if (!email.includes('@')) { setEmailAvailable(null); return }
    setEmailChecking(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/check-email?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      setEmailAvailable(data.available)
      setEmailChecking(false)
    }, 400)
    return () => clearTimeout(t)
  }, [email])

  function handleRoleChange(r: string) {
    setRole(r)
    setPermissions(getPresetForRole(r))
    setShowCustomPerms(r === 'CUSTOM')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!emailAvailable) { setError('Email is already in use'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, role, department, title, permissions }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create user'); return }
      onSuccess()
      onClose()
    } catch (e: any) { setError(e?.message ?? 'Network error') } finally { setSaving(false) }
  }

  const strength = getPasswordStrength(password)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Team Member"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button form="add-user-form" type="submit" disabled={saving} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      }
    >
      <form id="add-user-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Section 1: Account Info */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#415A77] mb-3">Account Info</p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">First Name *</label>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} placeholder="Jane" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Last Name *</label>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="Smith" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Work Email *</label>
              <div className="relative">
                <input
                  required type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="jane@company.com"
                />
                {emailChecking && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Checking…</span>}
                {!emailChecking && emailAvailable === true && email.includes('@') && (
                  <CheckCircle2 size={14} className="absolute right-3 top-2.5 text-emerald-500" />
                )}
                {!emailChecking && emailAvailable === false && (
                  <XCircle size={14} className="absolute right-3 top-2.5 text-red-500" />
                )}
              </div>
              {emailAvailable === false && <p className="mt-1 text-xs text-red-500">Email already in use</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Password *</label>
              <div className="relative">
                <input
                  required type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={inputClass} placeholder="Min 8 characters"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {password && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${strength.color}`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Confirm Password *</label>
              <input
                required type={showPassword ? 'text' : 'password'}
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass} placeholder="Re-enter password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Role & Access */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#415A77] mb-3">Role & Access</p>
          <div className="flex flex-col gap-3">
            <RoleSelector value={role} onChange={handleRoleChange} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
                <input
                  list="dept-options" value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={inputClass} placeholder="e.g. Sales"
                />
                <datalist id="dept-options">
                  {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Account Executive" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Permissions */}
        {(showCustomPerms || role === 'CUSTOM') && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#415A77]">Permissions</p>
              <button type="button" onClick={() => setPermissions(getPresetForRole(role))}
                className="text-xs text-[#415A77] hover:underline">
                Reset to {ROLE_LABELS[role] ?? role} defaults
              </button>
            </div>
            <PermissionsAccordion permissions={permissions} onChange={setPermissions} />
          </div>
        )}
        {role !== 'CUSTOM' && (
          <button type="button" onClick={() => setShowCustomPerms((v) => !v)}
            className="text-xs text-[#415A77] hover:underline text-left">
            {showCustomPerms ? 'Hide permissions' : 'Customize permissions'}
          </button>
        )}

      </form>
    </Modal>
  )
}

// ─── Edit User SlideOver ──────────────────────────────────────────────────────

function EditUserSlideOver({ user, open, onClose, onSuccess }: {
  user: UserRecord | null; open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('SALES_REP')
  const [department, setDepartment] = useState('')
  const [title, setTitle] = useState('')
  const [permissions, setPermissions] = useState<Record<string, any>>({})
  const [roleChangeWarning, setRoleChangeWarning] = useState(false)
  const [pendingRole, setPendingRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName); setLastName(user.lastName)
      setEmail(user.email); setRole(user.role)
      setDepartment(user.department ?? ''); setTitle(user.title ?? '')
      setPermissions(user.permissions); setError('')
    }
  }, [user])

  function handleRoleChange(r: string) {
    if (r !== role) {
      setPendingRole(r)
      setRoleChangeWarning(true)
    }
  }

  function confirmRoleChange() {
    setRole(pendingRole)
    setPermissions(getPresetForRole(pendingRole))
    setRoleChangeWarning(false)
    setPendingRole('')
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/users/${user!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, role, department, title, permissions }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      onSuccess(); onClose()
    } catch (e: any) { setError(e?.message ?? 'Network error') } finally { setSaving(false) }
  }

  if (!user) return null

  return (
    <SlideOver open={open} onClose={onClose} title={`Edit ${user.firstName} ${user.lastName}`} width={480}>
      <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full pb-24">
        {/* Profile */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#415A77] mb-3">Profile</p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">First Name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Last Name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Work Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
                <input list="dept-options-edit" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
                <datalist id="dept-options-edit">
                  {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* Role */}
        {user.role !== 'ADMIN' && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#415A77] mb-3">Role</p>
            <RoleSelector value={role} onChange={handleRoleChange} />
          </div>
        )}

        {/* Permissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#415A77]">Permissions</p>
            {user.role !== 'ADMIN' && (
              <button type="button" onClick={() => setPermissions(getPresetForRole(role))}
                className="text-xs text-[#415A77] hover:underline">
                Reset to defaults
              </button>
            )}
          </div>
          {user.role === 'ADMIN' ? (
            <p className="text-xs text-gray-500">Admin has all permissions and they cannot be modified.</p>
          ) : (
            <PermissionsAccordion permissions={permissions} onChange={setPermissions} />
          )}
        </div>

        {/* Account Status */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#415A77] mb-3">Account Status</p>
          <div className="rounded-xl border border-gray-100 bg-white p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {user.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Last login</span>
              <span className="text-xs text-gray-700">
                {user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : 'Never'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Member since</span>
              <span className="text-xs text-gray-700">{format(new Date(user.createdAt), 'MMM d, yyyy')}</span>
            </div>
            {user.createdByUser && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Created by</span>
                <span className="text-xs text-gray-700">
                  {`${user.createdByUser.firstName} ${user.createdByUser.lastName}`.trim() || user.createdByUser.name || '—'}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Role change warning */}
      <ConfirmDialog
        open={roleChangeWarning}
        onClose={() => { setRoleChangeWarning(false); setPendingRole('') }}
        onConfirm={confirmRoleChange}
        title="Change Role?"
        description={`Changing to ${ROLE_LABELS[pendingRole] ?? pendingRole} will reset their permissions to the ${ROLE_LABELS[pendingRole] ?? pendingRole} defaults. Any custom permissions will be lost.`}
      />
    </SlideOver>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<UserRecord | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null)
  const [copiedTempPwd, setCopiedTempPwd] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) setUsers(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleStatusToggle(id: string, active: boolean) {
    await fetch(`/api/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    fetchUsers()
    setDeactivateId(null)
  }

  async function handleResetPassword(id: string, name: string) {
    const res = await fetch(`/api/users/${id}/reset-password`, { method: 'PATCH' })
    const data = await res.json()
    if (data.tempPassword) {
      setTempPassword({ name, password: data.tempPassword })
    }
    setResetPasswordId(null)
  }

  const deactivateTarget = users.find((u) => u.id === deactivateId)
  const resetTarget = users.find((u) => u.id === resetPasswordId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
          <p className="text-xs text-gray-500">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1B263B]"
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const isSelf = u.id === currentUserId
            const displayName = `${u.firstName} ${u.lastName}`.trim() || u.name || u.email
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <CRMAvatar name={displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                      {isSelf && <span className="ml-1 text-xs text-gray-400">(You)</span>}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Last login: {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : 'Never'}
                  </p>
                </div>

                {!isSelf && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === u.id ? null : u.id)}
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {menuOpen === u.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-gray-100 bg-white shadow-lg py-1 overflow-hidden">
                          <button
                            onClick={() => { setEditUser(u); setMenuOpen(null) }}
                            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit User
                          </button>
                          <button
                            onClick={() => { setResetPasswordId(u.id); setMenuOpen(null) }}
                            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Reset Password
                          </button>
                          {u.active ? (
                            <button
                              onClick={() => { setDeactivateId(u.id); setMenuOpen(null) }}
                              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => { handleStatusToggle(u.id, true); setMenuOpen(null) }}
                              className="block w-full px-3 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchUsers} currentUserId={currentUserId} />
      <EditUserSlideOver user={editUser} open={!!editUser} onClose={() => setEditUser(null)} onSuccess={fetchUsers} />

      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={() => deactivateTarget && handleStatusToggle(deactivateTarget.id, false)}
        title={`Deactivate ${deactivateTarget ? `${deactivateTarget.firstName} ${deactivateTarget.lastName}`.trim() : 'User'}?`}
        description="They will lose access immediately. Their data will remain intact."
        destructive
      />

      <ConfirmDialog
        open={!!resetPasswordId}
        onClose={() => setResetPasswordId(null)}
        onConfirm={() => resetTarget && handleResetPassword(resetTarget.id, `${resetTarget.firstName} ${resetTarget.lastName}`.trim())}
        title="Reset Password?"
        description={`This will generate a temporary password you can share with ${resetTarget ? `${resetTarget.firstName} ${resetTarget.lastName}`.trim() : 'this user'}.`}
      />

      {/* Temp password modal */}
      <Modal open={!!tempPassword} onClose={() => { setTempPassword(null); setCopiedTempPwd(false) }} title="Temporary Password" size="sm">
        {tempPassword && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              Temporary password for <strong>{tempPassword.name}</strong>. Copy this now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <code className="flex-1 text-sm font-mono text-gray-900">{tempPassword.password}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(tempPassword.password); setCopiedTempPwd(true) }}
                className="rounded-md bg-[#0D1B2A] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1B263B]"
              >
                {copiedTempPwd ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => { setTempPassword(null); setCopiedTempPwd(false) }}
                className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B]">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const tabs = [
    { key: 'general', label: 'General' },
    ...(isAdmin ? [{ key: 'users', label: 'Users' }] : []),
  ]

  const [activeTab, setActiveTab] = useState('general')

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your CRM configuration." />

      {isAdmin && (
        <TabGroup
          tabs={tabs}
          active={activeTab}
          onChange={setActiveTab}
          className="mb-6"
        />
      )}

      {activeTab === 'general' && (
        <div className="space-y-8">
          {SETTINGS_CATEGORIES.map(({ label, sections }) => (
            <div key={label}>
              <p className="mb-3 text-[11px] font-bold tracking-widest text-[#415A77] uppercase">{label}</p>
              <div className="space-y-2">
                {sections.map(({ href, icon: Icon, title, description, external }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:border-[#415A77]/30 hover:shadow-md transition-all group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D1B2A]/5 text-[#415A77] group-hover:bg-[#415A77] group-hover:text-white transition-colors">
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{description}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'users' && isAdmin && session?.user?.id && (
        <UsersTab currentUserId={session.user.id} />
      )}
    </div>
  )
}
