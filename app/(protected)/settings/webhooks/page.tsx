'use client'

import { useState, useEffect, useCallback } from 'react'
import { Webhook, Plus, Trash2, Zap, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Play } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

const ALL_EVENTS = [
  'contact.created',
  'contact.updated',
  'opportunity.stage_changed',
  'appointment.booked',
  'appointment.no_show',
  'payment.received',
  'payment.failed',
  'form.submitted',
  'task.completed',
]

type WebhookEndpoint = {
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
  _count: { logs: number }
}

type WebhookLog = {
  id: string
  event: string
  statusCode: number | null
  success: boolean
  attempt: number
  createdAt: string
}

function NewEndpointModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (url: string, events: string[]) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function toggle(event: string) {
    setEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event])
  }

  async function handleCreate() {
    if (!url.trim() || events.length === 0) return
    setLoading(true)
    try {
      await onCreate(url.trim(), events)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="h-9 w-9 rounded-xl bg-[#0D1B2A] flex items-center justify-center">
            <Webhook size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">New Webhook Endpoint</h3>
            <p className="text-xs text-gray-500">We'll POST signed JSON to this URL when events fire.</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Endpoint URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/crm"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#415A77]/50 focus:ring-1 focus:ring-[#415A77]/20 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Events to Subscribe</label>
            <div className="space-y-1">
              {ALL_EVENTS.map((e) => (
                <button
                  key={e}
                  onClick={() => toggle(e)}
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-lg border px-3 py-2 text-left transition-all',
                    events.includes(e)
                      ? 'border-[#415A77]/40 bg-[#415A77]/5'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  )}
                >
                  <div className={cn('h-3.5 w-3.5 rounded border flex-shrink-0 transition-all', events.includes(e) ? 'bg-[#415A77] border-[#415A77]' : 'border-gray-300')} />
                  <code className="text-xs font-mono text-gray-700">{e}</code>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!url.trim() || events.length === 0 || loading}
            className="flex items-center gap-2 rounded-xl bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            {loading ? 'Creating…' : 'Add Endpoint'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LogRow({ log }: { log: WebhookLog }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      {log.success
        ? <CheckCircle size={13} className="text-emerald-500 shrink-0" />
        : <XCircle size={13} className="text-red-400 shrink-0" />
      }
      <code className="font-mono text-gray-600 w-40 truncate">{log.event}</code>
      <span className={cn('font-medium', log.success ? 'text-emerald-600' : 'text-red-500')}>
        {log.statusCode ?? 'ERR'}
      </span>
      <span className="text-gray-400 ml-auto">{new Date(log.createdAt).toLocaleString()}</span>
    </div>
  )
}

export default function WebhooksSettingsPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [logs, setLogs] = useState<Record<string, WebhookLog[]>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhook-endpoints')
      const data = await res.json().catch(() => ({}))
      setEndpoints(data.endpoints ?? [])
    } catch {
      setEndpoints([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadLogs(id: string) {
    if (logs[id]) return
    const res = await fetch(`/api/webhook-endpoints/${id}`)
    const data = await res.json().catch(() => ({}))
    setLogs((prev) => ({ ...prev, [id]: data.endpoint?.logs ?? [] }))
  }

  function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadLogs(id)
    }
  }

  async function handleCreate(url: string, events: string[]) {
    await fetch('/api/webhook-endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events }),
    })
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook endpoint?')) return
    await fetch(`/api/webhook-endpoints/${id}`, { method: 'DELETE' })
    setEndpoints((prev) => prev.filter((e) => e.id !== id))
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/webhook-endpoints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, active } : e))
  }

  async function sendTest(id: string) {
    setTesting(id)
    setTestResult((prev) => ({ ...prev, [id]: null }))
    try {
      const res = await fetch(`/api/webhook-endpoints/${id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult((prev) => ({ ...prev, [id]: data.success }))
      setLogs((prev) => ({ ...prev, [id]: undefined as unknown as WebhookLog[] }))
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Webhooks"
        subtitle="Receive real-time POST notifications when events happen in your CRM."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#0D1B2A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors"
          >
            <Plus size={15} />
            Add Endpoint
          </button>
        }
      />

      {/* Signature info */}
      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-700">Verifying Signatures</p>
        <code className="block text-[11px] font-mono text-gray-600 bg-white border border-gray-100 rounded-lg px-3 py-2 leading-relaxed">
          {`const sig = req.headers['x-signature'];\nconst expected = 'sha256=' + crypto.createHmac('sha256', SECRET)\n  .update(rawBody).digest('hex');\nif (sig !== expected) return res.status(401).end();`}
        </code>
      </div>

      {/* Endpoints */}
      <div className="mt-6 space-y-3">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))
        ) : endpoints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <Webhook size={24} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No webhook endpoints yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first endpoint to start receiving events.</p>
          </div>
        ) : (
          endpoints.map((ep) => (
            <div key={ep.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', ep.active ? 'bg-emerald-50' : 'bg-gray-100')}>
                  <Zap size={16} className={ep.active ? 'text-emerald-600' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gray-800 truncate">{ep.url}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold', ep.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                      {ep.active ? 'Active' : 'Paused'}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {ep._count.logs} deliveries
                    </span>
                    {ep.events.slice(0, 3).map((e) => (
                      <span key={e} className="text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">{e}</span>
                    ))}
                    {ep.events.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{ep.events.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {testResult[ep.id] === true && <CheckCircle size={14} className="text-emerald-500" />}
                  {testResult[ep.id] === false && <XCircle size={14} className="text-red-400" />}
                  <button
                    onClick={() => sendTest(ep.id)}
                    disabled={testing === ep.id}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-all"
                  >
                    <Play size={11} />
                    {testing === ep.id ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleExpand(ep.id)}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    {expandedId === ep.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button
                    onClick={() => toggleActive(ep.id, !ep.active)}
                    className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all', ep.active ? 'bg-gray-50 text-gray-600 hover:bg-gray-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}
                  >
                    {ep.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleDelete(ep.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedId === ep.id && (
                <div className="border-t border-gray-50 bg-gray-50/50">
                  <div className="px-4 py-3">
                    <p className="text-[11px] font-semibold text-gray-500 mb-2">Recent Deliveries</p>
                    {!logs[ep.id] ? (
                      <div className="h-8 rounded bg-gray-200 animate-pulse" />
                    ) : logs[ep.id].length === 0 ? (
                      <p className="text-xs text-gray-400">No deliveries yet.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {logs[ep.id].map((log) => <LogRow key={log.id} log={log} />)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && <NewEndpointModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  )
}
