'use client'

import { useState } from 'react'
import { Copy, Check, ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type Param = { name: string; type: string; required?: boolean; desc: string }

type Endpoint = {
  id: string
  method: Method
  path: string
  scope: string
  summary: string
  params?: Param[]
  bodyParams?: Param[]
  responseExample: string
}

type Section = {
  id: string
  label: string
  endpoints: Endpoint[]
}

const METHOD_COLORS: Record<Method, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-emerald-100 text-emerald-700',
  PATCH: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-600',
}

const BASE_URL = '/api/v1'

const SECTIONS: Section[] = [
  {
    id: 'auth',
    label: 'Authentication',
    endpoints: [],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    endpoints: [
      {
        id: 'contacts-list',
        method: 'GET',
        path: '/contacts',
        scope: 'contacts:read',
        summary: 'List all contacts with optional search and status filter.',
        params: [
          { name: 'page', type: 'number', desc: 'Page number (default: 1)' },
          { name: 'perPage', type: 'number', desc: 'Results per page, max 100 (default: 20)' },
          { name: 'search', type: 'string', desc: 'Search by name or email' },
          { name: 'status', type: 'string', desc: 'Filter by leadStatus (NEW, QUALIFIED, etc.)' },
        ],
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@acme.com",
      "leadStatus": "QUALIFIED",
      "company": { "id": "...", "name": "Acme Corp" }
    }
  ],
  "meta": { "page": 1, "perPage": 20, "total": 142, "pages": 8 }
}`,
      },
      {
        id: 'contacts-create',
        method: 'POST',
        path: '/contacts',
        scope: 'contacts:write',
        summary: 'Create a new contact.',
        bodyParams: [
          { name: 'firstName', type: 'string', required: true, desc: 'Contact first name' },
          { name: 'lastName', type: 'string', desc: 'Contact last name' },
          { name: 'email', type: 'string', desc: 'Email address' },
          { name: 'phone', type: 'string', desc: 'Phone number' },
          { name: 'companyId', type: 'string', desc: 'Company ID to link' },
          { name: 'leadStatus', type: 'string', desc: 'NEW | CONTACTED | QUALIFIED | PROPOSAL | WON | LOST' },
        ],
        responseExample: `{ "success": true, "data": { "id": "clx...", "firstName": "Jane", ... } }`,
      },
      {
        id: 'contacts-get',
        method: 'GET',
        path: '/contacts/:id',
        scope: 'contacts:read',
        summary: 'Get a single contact with opportunities and open tasks.',
        responseExample: `{
  "success": true,
  "data": {
    "id": "clx...",
    "firstName": "Jane",
    "opportunities": [...],
    "tasks": [...]
  }
}`,
      },
      {
        id: 'contacts-update',
        method: 'PATCH',
        path: '/contacts/:id',
        scope: 'contacts:write',
        summary: 'Update contact fields. Only provided fields are updated.',
        bodyParams: [
          { name: 'firstName', type: 'string', desc: 'First name' },
          { name: 'lastName', type: 'string', desc: 'Last name' },
          { name: 'email', type: 'string', desc: 'Email address' },
          { name: 'leadStatus', type: 'string', desc: 'Lead status' },
          { name: 'notes', type: 'string', desc: 'Notes' },
        ],
        responseExample: `{ "success": true, "data": { "id": "clx...", ... } }`,
      },
      {
        id: 'contacts-delete',
        method: 'DELETE',
        path: '/contacts/:id',
        scope: 'contacts:write',
        summary: 'Delete a contact permanently.',
        responseExample: `{ "success": true, "data": { "deleted": true } }`,
      },
      {
        id: 'contacts-tasks',
        method: 'GET',
        path: '/contacts/:id/tasks',
        scope: 'tasks:read',
        summary: 'List all tasks linked to a contact.',
        responseExample: `{ "success": true, "data": [...] }`,
      },
      {
        id: 'contacts-messages',
        method: 'GET',
        path: '/contacts/:id/messages',
        scope: 'messages:read',
        summary: 'List message history for a contact (last 50).',
        responseExample: `{ "success": true, "data": [...] }`,
      },
      {
        id: 'contacts-opportunities',
        method: 'GET',
        path: '/contacts/:id/opportunities',
        scope: 'opportunities:read',
        summary: 'List all opportunities linked to a contact.',
        responseExample: `{ "success": true, "data": [...] }`,
      },
    ],
  },
  {
    id: 'companies',
    label: 'Companies',
    endpoints: [
      {
        id: 'companies-list',
        method: 'GET',
        path: '/companies',
        scope: 'companies:read',
        summary: 'List companies with optional search.',
        params: [
          { name: 'search', type: 'string', desc: 'Search by company name' },
          { name: 'page', type: 'number', desc: 'Page number' },
          { name: 'perPage', type: 'number', desc: 'Results per page' },
        ],
        responseExample: `{ "success": true, "data": [...], "meta": { ... } }`,
      },
      {
        id: 'companies-create',
        method: 'POST',
        path: '/companies',
        scope: 'companies:write',
        summary: 'Create a new company.',
        bodyParams: [
          { name: 'name', type: 'string', required: true, desc: 'Company name' },
          { name: 'website', type: 'string', desc: 'Website URL' },
          { name: 'industry', type: 'string', desc: 'Industry category' },
          { name: 'location', type: 'string', desc: 'Location' },
        ],
        responseExample: `{ "success": true, "data": { "id": "...", "name": "Acme Corp" } }`,
      },
      {
        id: 'companies-get',
        method: 'GET',
        path: '/companies/:id',
        scope: 'companies:read',
        summary: 'Get a company with contacts list.',
        responseExample: `{ "success": true, "data": { "id": "...", "contacts": [...] } }`,
      },
      {
        id: 'companies-update',
        method: 'PATCH',
        path: '/companies/:id',
        scope: 'companies:write',
        summary: 'Update company fields.',
        bodyParams: [
          { name: 'name', type: 'string', desc: 'Company name' },
          { name: 'website', type: 'string', desc: 'Website URL' },
          { name: 'industry', type: 'string', desc: 'Industry' },
        ],
        responseExample: `{ "success": true, "data": { ... } }`,
      },
    ],
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    endpoints: [
      {
        id: 'opps-list',
        method: 'GET',
        path: '/opportunities',
        scope: 'opportunities:read',
        summary: 'List open opportunities. Filter by pipeline or stage.',
        params: [
          { name: 'pipelineId', type: 'string', desc: 'Filter by pipeline' },
          { name: 'stageId', type: 'string', desc: 'Filter by stage' },
          { name: 'page', type: 'number', desc: 'Page number' },
        ],
        responseExample: `{ "success": true, "data": [...], "meta": { ... } }`,
      },
      {
        id: 'opps-create',
        method: 'POST',
        path: '/opportunities',
        scope: 'opportunities:write',
        summary: 'Create a new opportunity.',
        bodyParams: [
          { name: 'title', type: 'string', required: true, desc: 'Opportunity title' },
          { name: 'stageId', type: 'string', required: true, desc: 'Pipeline stage ID' },
          { name: 'pipelineId', type: 'string', required: true, desc: 'Pipeline ID' },
          { name: 'value', type: 'number', desc: 'Deal value in dollars' },
          { name: 'contactId', type: 'string', desc: 'Contact to link' },
          { name: 'expectedCloseDate', type: 'string', desc: 'ISO date string' },
        ],
        responseExample: `{ "success": true, "data": { "id": "...", "title": "...", "stage": { "name": "Proposal" } } }`,
      },
      {
        id: 'opps-get',
        method: 'GET',
        path: '/opportunities/:id',
        scope: 'opportunities:read',
        summary: 'Get opportunity with stage and pipeline info.',
        responseExample: `{ "success": true, "data": { ... } }`,
      },
      {
        id: 'opps-update',
        method: 'PATCH',
        path: '/opportunities/:id',
        scope: 'opportunities:write',
        summary: 'Update opportunity. Moving stageId fires the opportunity.stage_changed webhook.',
        bodyParams: [
          { name: 'title', type: 'string', desc: 'Title' },
          { name: 'value', type: 'number', desc: 'Deal value' },
          { name: 'stageId', type: 'string', desc: 'Move to this stage' },
          { name: 'outcome', type: 'string', desc: 'WON | LOST' },
        ],
        responseExample: `{ "success": true, "data": { ... } }`,
      },
      {
        id: 'opps-delete',
        method: 'DELETE',
        path: '/opportunities/:id',
        scope: 'opportunities:write',
        summary: 'Delete an opportunity.',
        responseExample: `{ "success": true, "data": { "deleted": true } }`,
      },
    ],
  },
  {
    id: 'pipelines',
    label: 'Pipelines',
    endpoints: [
      {
        id: 'pipelines-list',
        method: 'GET',
        path: '/pipelines',
        scope: 'opportunities:read',
        summary: 'List all pipelines with stages.',
        responseExample: `{ "success": true, "data": [...] }`,
      },
      {
        id: 'pipelines-stages',
        method: 'GET',
        path: '/pipelines/:id/stages',
        scope: 'opportunities:read',
        summary: 'List stages for a specific pipeline.',
        responseExample: `{ "success": true, "data": [...] }`,
      },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    endpoints: [
      {
        id: 'tasks-list',
        method: 'GET',
        path: '/tasks',
        scope: 'tasks:read',
        summary: 'List tasks with optional status and contact filters.',
        params: [
          { name: 'status', type: 'string', desc: 'TODO | IN_PROGRESS | COMPLETED' },
          { name: 'contactId', type: 'string', desc: 'Filter by contact' },
          { name: 'page', type: 'number', desc: 'Page number' },
        ],
        responseExample: `{ "success": true, "data": [...], "meta": { ... } }`,
      },
      {
        id: 'tasks-create',
        method: 'POST',
        path: '/tasks',
        scope: 'tasks:write',
        summary: 'Create a new task.',
        bodyParams: [
          { name: 'title', type: 'string', required: true, desc: 'Task title' },
          { name: 'contactId', type: 'string', desc: 'Contact to link' },
          { name: 'dueDate', type: 'string', desc: 'ISO date string' },
          { name: 'priority', type: 'string', desc: 'LOW | MEDIUM | HIGH' },
          { name: 'status', type: 'string', desc: 'TODO | IN_PROGRESS' },
        ],
        responseExample: `{ "success": true, "data": { "id": "...", "title": "...", "status": "TODO" } }`,
      },
      {
        id: 'tasks-update',
        method: 'PATCH',
        path: '/tasks/:id',
        scope: 'tasks:write',
        summary: 'Update a task. Setting status to COMPLETED fires the task.completed webhook.',
        bodyParams: [
          { name: 'status', type: 'string', desc: 'TODO | IN_PROGRESS | COMPLETED' },
          { name: 'priority', type: 'string', desc: 'LOW | MEDIUM | HIGH' },
          { name: 'dueDate', type: 'string', desc: 'ISO date string' },
        ],
        responseExample: `{ "success": true, "data": { ... } }`,
      },
      {
        id: 'tasks-delete',
        method: 'DELETE',
        path: '/tasks/:id',
        scope: 'tasks:write',
        summary: 'Delete a task.',
        responseExample: `{ "success": true, "data": { "deleted": true } }`,
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    endpoints: [
      {
        id: 'cal-list',
        method: 'GET',
        path: '/calendar/events',
        scope: 'calendar:read',
        summary: 'List calendar events. Filter by date range.',
        params: [
          { name: 'from', type: 'string', desc: 'Start date (ISO string)' },
          { name: 'to', type: 'string', desc: 'End date (ISO string)' },
          { name: 'page', type: 'number', desc: 'Page number' },
        ],
        responseExample: `{ "success": true, "data": [...], "meta": { ... } }`,
      },
      {
        id: 'cal-create',
        method: 'POST',
        path: '/calendar/events',
        scope: 'calendar:write',
        summary: 'Create a calendar event.',
        bodyParams: [
          { name: 'title', type: 'string', required: true, desc: 'Event title' },
          { name: 'startTime', type: 'string', required: true, desc: 'ISO datetime string' },
          { name: 'endTime', type: 'string', required: true, desc: 'ISO datetime string' },
          { name: 'contactId', type: 'string', desc: 'Contact to link' },
          { name: 'notes', type: 'string', desc: 'Event notes' },
        ],
        responseExample: `{ "success": true, "data": { "id": "...", "title": "...", "startTime": "..." } }`,
      },
      {
        id: 'cal-update',
        method: 'PATCH',
        path: '/calendar/events/:id',
        scope: 'calendar:write',
        summary: 'Update event. Setting status to NO_SHOW fires the appointment.no_show webhook.',
        bodyParams: [
          { name: 'title', type: 'string', desc: 'Event title' },
          { name: 'status', type: 'string', desc: 'CONFIRMED | CANCELLED | NO_SHOW | COMPLETED' },
          { name: 'notes', type: 'string', desc: 'Notes' },
        ],
        responseExample: `{ "success": true, "data": { ... } }`,
      },
    ],
  },
  {
    id: 'messages',
    label: 'Messages',
    endpoints: [
      {
        id: 'messages-list',
        method: 'GET',
        path: '/messages/:contactId',
        scope: 'messages:read',
        summary: 'Get message history for a contact.',
        responseExample: `{ "success": true, "data": [...], "meta": { ... } }`,
      },
      {
        id: 'messages-send',
        method: 'POST',
        path: '/messages/send',
        scope: 'messages:write',
        summary: 'Log an outbound message.',
        bodyParams: [
          { name: 'contactId', type: 'string', required: true, desc: 'Contact to message' },
          { name: 'channel', type: 'string', required: true, desc: 'EMAIL | SMS' },
          { name: 'body', type: 'string', required: true, desc: 'Message content' },
          { name: 'subject', type: 'string', desc: 'Subject (for EMAIL)' },
        ],
        responseExample: `{ "success": true, "data": { "id": "...", "direction": "OUTBOUND" } }`,
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    endpoints: [
      {
        id: 'products-list',
        method: 'GET',
        path: '/products',
        scope: 'products:read',
        summary: 'List your products.',
        params: [
          { name: 'active', type: 'boolean', desc: 'Filter by active status' },
        ],
        responseExample: `{ "success": true, "data": [...], "meta": { ... } }`,
      },
      {
        id: 'products-get',
        method: 'GET',
        path: '/products/:id',
        scope: 'products:read',
        summary: 'Get a single product.',
        responseExample: `{ "success": true, "data": { "id": "...", "name": "Pro Plan", "price": 99 } }`,
      },
    ],
  },
  {
    id: 'metrics',
    label: 'Metrics',
    endpoints: [
      {
        id: 'metrics-summary',
        method: 'GET',
        path: '/metrics/summary',
        scope: 'metrics:read',
        summary: 'High-level CRM summary: contacts, revenue, open deals, task completions.',
        responseExample: `{
  "success": true,
  "data": {
    "contacts": { "total": 1240, "newThisMonth": 38 },
    "revenue": { "total": 94200 },
    "opportunities": { "open": 23 },
    "tasks": { "completedThisWeek": 14 },
    "companies": { "total": 87 }
  }
}`,
      },
    ],
  },
  {
    id: 'automations',
    label: 'Automations',
    endpoints: [
      {
        id: 'automations-trigger',
        method: 'POST',
        path: '/automations/trigger',
        scope: 'automations:trigger',
        summary: 'Trigger an automation by ID or trigger name.',
        bodyParams: [
          { name: 'automationId', type: 'string', desc: 'Automation ID (or use trigger)' },
          { name: 'trigger', type: 'string', desc: 'Trigger name (or use automationId)' },
          { name: 'contactId', type: 'string', desc: 'Contact to run automation for' },
          { name: 'payload', type: 'object', desc: 'Additional context data' },
        ],
        responseExample: `{ "success": true, "data": { "queued": true, "queueId": "...", "automationId": "..." } }`,
      },
    ],
  },
]

// ─── Components ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-medium text-white/70 hover:text-white transition-all"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ParamTable({ params, title }: { params: Param[]; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {params.map((p) => (
              <tr key={p.name} className="bg-white">
                <td className="px-3 py-2 font-mono text-[11px]">
                  {p.name}
                  {p.required && <span className="ml-1 text-red-500">*</span>}
                </td>
                <td className="px-3 py-2 text-gray-400">{p.type}</td>
                <td className="px-3 py-2 text-gray-600">{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false)
  const fullPath = `${BASE_URL}${ep.path}`

  return (
    <div id={ep.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={cn('inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold shrink-0', METHOD_COLORS[ep.method])}>
          {ep.method}
        </span>
        <code className="flex-1 text-sm font-mono text-gray-700 truncate">{fullPath}</code>
        <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 mr-2">
          <Lock size={9} />
          {ep.scope}
        </span>
        <ChevronRight size={14} className={cn('text-gray-300 transition-transform shrink-0', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-4">
          <p className="text-sm text-gray-600">{ep.summary}</p>

          {ep.params && ep.params.length > 0 && (
            <ParamTable params={ep.params} title="Query Parameters" />
          )}
          {ep.bodyParams && ep.bodyParams.length > 0 && (
            <ParamTable params={ep.bodyParams} title="Request Body" />
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Response</p>
            <div className="rounded-xl bg-[#0D1B2A] relative">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-[10px] font-mono text-white/40">application/json</span>
                <CopyButton text={ep.responseExample} />
              </div>
              <pre className="text-[11px] font-mono text-emerald-300 px-3 py-3 overflow-x-auto leading-relaxed">
                {ep.responseExample}
              </pre>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Example Request</p>
            <div className="rounded-xl bg-[#0D1B2A] relative">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-[10px] font-mono text-white/40">curl</span>
                <CopyButton text={`curl -H "Authorization: Bearer crm_your_key" https://yourapp.com${fullPath}`} />
              </div>
              <pre className="text-[11px] font-mono text-blue-300 px-3 py-3 overflow-x-auto leading-relaxed">
                {`curl -H "Authorization: Bearer crm_your_key" \\
  https://yourapp.com${fullPath}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('auth')

  const contentSections = SECTIONS.filter((s) => s.id !== 'auth')

  return (
    <div className="flex h-[calc(100vh-112px)] gap-0 rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">
      {/* Sidebar */}
      <div className="w-52 shrink-0 flex flex-col border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">API Reference</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">v1 · REST</p>
        </div>
        <nav className="p-2">
          <button
            onClick={() => setActiveSection('auth')}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors mb-1',
              activeSection === 'auth' ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Authentication
          </button>
          {contentSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors mb-0.5',
                activeSection === s.id ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span>{s.label}</span>
              <span className="ml-2 text-[10px] opacity-50">{s.endpoints.length}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl p-6 mx-auto">

          {activeSection === 'auth' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Authentication</h1>
                <p className="text-gray-500 mt-1.5">All API requests require a Bearer token in the Authorization header.</p>
              </div>

              <div className="rounded-2xl bg-[#0D1B2A] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                  <span className="text-xs font-mono text-white/40">Authorization header</span>
                  <CopyButton text={`Authorization: Bearer crm_your_api_key_here`} />
                </div>
                <pre className="text-sm font-mono text-emerald-300 px-4 py-3">
                  {`Authorization: Bearer crm_your_api_key_here`}
                </pre>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Rate Limiting</h3>
                  <p className="text-sm text-gray-600">1,000 requests per hour per API key. Exceeded requests return HTTP 429 with a <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">Retry-After</code> header.</p>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Error Format</h3>
                  <pre className="text-xs font-mono text-gray-700 bg-gray-50 rounded-xl p-3">{`{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Contact not found"
  }
}`}</pre>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Scopes</h3>
                  <p className="text-sm text-gray-600 mb-3">API keys are scoped to specific resources. Generate keys at <a href="/settings/api" className="text-[#415A77] hover:underline">/settings/api</a>.</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      'contacts:read', 'contacts:write', 'companies:read', 'companies:write',
                      'opportunities:read', 'opportunities:write', 'tasks:read', 'tasks:write',
                      'calendar:read', 'calendar:write', 'messages:read', 'messages:write',
                      'products:read', 'automations:trigger', 'metrics:read',
                    ].map((s) => (
                      <span key={s} className="text-[10px] font-mono text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-2 py-1">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {contentSections.map((section) =>
            activeSection === section.id ? (
              <div key={section.id} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{section.label}</h1>
                  <p className="text-gray-500 mt-1 text-sm">{section.endpoints.length} endpoint{section.endpoints.length !== 1 ? 's' : ''}</p>
                </div>
                {section.endpoints.map((ep) => (
                  <EndpointCard key={ep.id} ep={ep} />
                ))}
              </div>
            ) : null
          )}

        </div>
      </div>
    </div>
  )
}
