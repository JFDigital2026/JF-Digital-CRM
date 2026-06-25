'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Key, Globe, Webhook, Eye, EyeOff, AlertTriangle, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

type ApiKey = {
  id: string
  name: string
  scopes: string[]
  active: boolean
  lastUsed: string | null
  createdAt: string
  _count: { logs: number }
}

type WebhookEndpoint = {
  id: string
  url: string
  events: string[]
  secret: string
  active: boolean
}

function CopyField({
  label,
  value,
  masked,
  mono = true,
}: {
  label: string
  value: string
  masked?: boolean
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(!masked)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <span className={cn('flex-1 text-sm min-w-0', mono && 'font-mono', !visible && 'tracking-widest text-gray-400 select-none')}>
          {visible ? value : '•'.repeat(Math.min(value.length, 32))}
        </span>
        {masked && (
          <button
            onClick={() => setVisible((v) => !v)}
            className="text-gray-400 hover:text-gray-600 p-1 transition-colors shrink-0"
            title={visible ? 'Hide' : 'Reveal'}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button
          onClick={copy}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shrink-0',
            copied
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
          )}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function ApiSettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<{ key: string; name: string } | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [showWebhooks, setShowWebhooks] = useState(false)

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/v1`
    : '/api/v1'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        fetch('/api/api-keys'),
        fetch('/api/webhook-endpoints'),
      ])
      const keysData = await keysRes.json().catch(() => ({}))
      const webhooksData = await webhooksRes.json().catch(() => ({}))
      setKeys(keysData.keys ?? [])
      setWebhooks(webhooksData.endpoints ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function generate() {
    const name = newKeyName.trim() || 'API Key'
    setGenerating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      setNewKeyValue({ key: data.key, name })
      setNewKeyName('')
      setShowNewForm(false)
      await load()
    } finally {
      setGenerating(false)
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    setConfirmRevoke(null)
    await load()
  }

  const activeKeys = keys.filter((k) => k.active)

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="API & Integrations"
        subtitle="Connect your CRM to Zapier, Make, n8n, or any custom tool."
      />

      {/* New key reveal banner */}
      {newKeyValue && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              Copy <strong>{newKeyValue.name}</strong> now — it won&apos;t be shown again.
            </p>
          </div>
          <CopyField label="New API Key" value={newKeyValue.key} masked />
          <button
            onClick={() => setNewKeyValue(null)}
            className="text-xs text-amber-600 hover:text-amber-800 underline"
          >
            I&apos;ve copied it
          </button>
        </div>
      )}

      {/* API Keys section */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#0D1B2A] flex items-center justify-center shrink-0">
              <Key size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">API Keys</p>
              <p className="text-xs text-gray-500">Each key can be used independently. Revoke one without affecting others.</p>
            </div>
          </div>
          <button
            onClick={() => { setShowNewForm((v) => !v); setNewKeyName('') }}
            className="flex items-center gap-1.5 rounded-xl bg-[#0D1B2A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1B263B] transition-colors"
          >
            <Plus size={13} />
            New Key
          </button>
        </div>

        {/* New key form */}
        {showNewForm && (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generate()}
              placeholder="Key name (e.g. Cloudflare Worker, Zapier)"
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              autoFocus
            />
            <button
              onClick={generate}
              disabled={generating}
              className="rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B263B] disabled:opacity-50 transition-colors shrink-0"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Key list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-3">No API keys yet.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 mx-auto rounded-xl bg-[#0D1B2A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors"
            >
              <Key size={14} />
              Generate your first key
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeKeys.map((k) => (
              <div key={k.id} className="py-3 first:pt-0 last:pb-0">
                {confirmRevoke === k.id ? (
                  <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                    <p className="flex-1 text-xs text-red-700">Revoke <strong>{k.name}</strong>? Any app using this key will break immediately.</p>
                    <button
                      onClick={() => revoke(k.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors shrink-0"
                    >
                      Revoke
                    </button>
                    <button
                      onClick={() => setConfirmRevoke(null)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{k.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {k._count.logs} requests ·{' '}
                        {k.lastUsed ? `Last used ${new Date(k.lastUsed).toLocaleDateString()}` : 'Never used'} ·{' '}
                        Created {new Date(k.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Active
                      </span>
                      <button
                        onClick={() => setConfirmRevoke(k.id)}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 size={12} />
                        Revoke
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Base URL */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#0D1B2A] flex items-center justify-center shrink-0">
            <Globe size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Base URL</p>
            <p className="text-xs text-gray-500">Prepend this to every API endpoint path.</p>
          </div>
        </div>
        <CopyField label="API Base URL" value={baseUrl} />
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">How to use</p>
          <code className="block text-[11px] font-mono text-gray-700 leading-relaxed">
            {`GET ${baseUrl}/contacts\nAuthorization: Bearer YOUR_API_KEY`}
          </code>
        </div>
      </div>

      {/* Webhook secrets */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <button
          onClick={() => setShowWebhooks((v) => !v)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Webhook size={14} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">Webhook Secrets</p>
            <p className="text-xs text-gray-400">Only needed if your CRM pushes events to an external app</p>
          </div>
          <ChevronDown size={15} className={`text-gray-300 transition-transform ${showWebhooks ? 'rotate-180' : ''}`} />
        </button>

        {showWebhooks && (
          <div className="border-t border-gray-50 p-4 space-y-3">
            <p className="text-xs text-gray-500">
              When your CRM sends an event to an outside URL, it signs the request with this secret so the receiver can verify it&apos;s genuine.
            </p>
            {loading ? (
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            ) : webhooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-400">No webhook endpoints configured.</p>
                <a href="/settings/webhooks" className="text-xs text-[#415A77] hover:underline mt-1 block">
                  Set one up in Webhook Settings →
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((ep) => (
                  <div key={ep.id} className="space-y-1.5">
                    <p className="text-[11px] font-mono text-gray-400 truncate">{ep.url}</p>
                    <CopyField label="Signing Secret" value={ep.secret} masked />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick reference */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700">Quick Reference</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          {[
            ['/contacts', 'List all contacts'],
            ['/contacts/:id', 'Get one contact'],
            ['/opportunities', 'List pipeline deals'],
            ['/tasks', 'List tasks'],
            ['/calendar/events', 'List events'],
            ['/metrics/summary', 'CRM overview stats'],
          ].map(([path, label]) => (
            <div key={path} className="flex items-center gap-2">
              <code className="font-mono text-[10px] text-[#415A77] shrink-0">{path}</code>
              <span className="text-gray-400 truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
