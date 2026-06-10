'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, RefreshCw, Key, Globe, Webhook, Eye, EyeOff, AlertTriangle, ChevronDown } from 'lucide-react'
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
  const [showWebhooks, setShowWebhooks] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

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

  const activeKey = keys.find((k) => k.active)

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My API Key' }),
      })
      const data = await res.json()
      setNewKey(data.key)
      await load()
    } finally {
      setGenerating(false)
    }
  }

  async function revokeAndRegenerate() {
    setGenerating(true)
    try {
      // Revoke all existing active keys
      for (const k of keys.filter((k) => k.active)) {
        await fetch(`/api/api-keys/${k.id}`, { method: 'DELETE' })
      }
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My API Key' }),
      })
      const data = await res.json()
      setNewKey(data.key)
      await load()
    } finally {
      setGenerating(false)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="API & Integrations"
        subtitle="Connect your CRM to Zapier, Make, n8n, or any custom tool."
      />

      {/* API Key section */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#0D1B2A] flex items-center justify-center shrink-0">
            <Key size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">API Key</p>
            <p className="text-xs text-gray-500">Use this in the Authorization header of every request.</p>
          </div>
        </div>

        {loading ? (
          <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
        ) : newKey ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">Copy this key now — it won't be shown again after you leave this page.</p>
            </div>
            <CopyField label="Your API Key" value={newKey} masked />
          </div>
        ) : activeKey ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500">Your API Key</p>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="flex-1 text-sm font-mono text-gray-400 tracking-widest select-none">
                  crm_{'•'.repeat(20)}
                </span>
                <span className="text-[10px] text-gray-400 italic shrink-0">Regenerate to reveal a new key</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-gray-400">Last used:</span>
              <span className="font-medium text-gray-700">
                {activeKey.lastUsed ? new Date(activeKey.lastUsed).toLocaleDateString() : 'Never'}
              </span>
              <span className="mx-1 text-gray-200">·</span>
              <span className="text-gray-400">{activeKey._count.logs} total requests</span>
            </div>
            {confirmDelete === 'regen' ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
                <p className="flex-1 text-xs text-red-700">Current key will stop working immediately. Continue?</p>
                <button
                  onClick={revokeAndRegenerate}
                  disabled={generating}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {generating ? 'Regenerating…' : 'Yes, regenerate'}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete('regen')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                <RefreshCw size={12} />
                Regenerate key
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">No API key yet.</p>
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 mx-auto rounded-xl bg-[#0D1B2A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-50 transition-colors"
            >
              <Key size={14} />
              {generating ? 'Generating…' : 'Generate API Key'}
            </button>
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

      {/* Webhook secrets — collapsed by default */}
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
              When your CRM sends an event to an outside URL (Zapier, Make, your own server), it signs the request with this secret so the receiver can verify it's genuine. You only need this if you&apos;ve configured an outbound webhook.
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
