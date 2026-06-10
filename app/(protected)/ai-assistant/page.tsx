'use client'

import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import {
  Sparkles, Plus, Trash2, Send, X, MessageSquare, Wrench, ChevronRight, Edit2, Check, CheckCircle2,
} from 'lucide-react'
import { useAI, type ChatMessage } from '@/components/ai/ai-provider'
import { useAIContext, buildSuggestedPrompts } from '@/hooks/use-ai-context'
import { cn } from '@/lib/utils'

type Conversation = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: { role: string; content: string }[]
  _count: { messages: number }
}

// ─── Reused UI ────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 h-4">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }} />
      ))}
    </span>
  )
}

function ToolBadge({ name, result }: { name: string; result?: string }) {
  const [expanded, setExpanded] = useState(false)
  const labels: Record<string, string> = {
    search_contacts: 'Searching contacts', get_contact_details: 'Getting contact',
    get_today_tasks: "Today's tasks", get_pipeline_summary: 'Pipeline', create_task: 'Creating task',
    move_opportunity: 'Moving opportunity', get_recent_activity: 'Activity',
  }
  return (
    <div className="mb-1">
      <button
        onClick={() => result && setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
          result ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-700 animate-pulse cursor-default'
        )}
      >
        <Wrench size={10} />
        {result ? <><CheckCircle2 size={10} />{labels[name] ?? name}</> : `${labels[name] ?? name}…`}
        {result && <ChevronRight size={10} className={cn('transition-transform', expanded && 'rotate-90')} />}
      </button>
      {expanded && result && (
        <pre className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-[11px] text-gray-600 whitespace-pre-wrap break-words">
          {result}
        </pre>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[72%] rounded-2xl rounded-tr-sm bg-[#0D1B2A] px-4 py-3 text-sm text-white leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-[#415A77] to-[#0D1B2A] flex items-center justify-center text-[10px] font-bold text-white mt-0.5">AI</div>
      <div className="flex-1 min-w-0 max-w-[80%]">
        {msg.toolEvents?.map((te, i) => <ToolBadge key={i} name={te.name} result={te.result} />)}
        <div className={cn('rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words', msg.toolEvents?.length && 'mt-1')}>
          {msg.isStreaming && !msg.content ? <TypingDots /> : msg.content || <TypingDots />}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const { messages, isLoading, sendMessage, clearMessages, setMessages } = useAI()
  const context = useAIContext()
  const suggestions = buildSuggestedPrompts(context)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load conversation list
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true)
    try {
      const res = await fetch('/api/ai/conversations')
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function startNewConversation() {
    setActiveConvId(null)
    clearMessages()
    setText('')
  }

  async function loadConversation(conv: Conversation) {
    const res = await fetch(`/api/ai/conversations/${conv.id}`)
    const data = await res.json()
    setActiveConvId(conv.id)
    setMessages(
      (data.messages ?? []).map((m: { role: string; content: string }, i: number) => ({
        id: `loaded-${i}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    )
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' })
    if (activeConvId === id) { setActiveConvId(null); clearMessages() }
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }

  async function saveTitle(id: string) {
    await fetch(`/api/ai/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle }),
    })
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: editTitle } : c))
    setEditingId(null)
  }

  async function handleSend(content: string) {
    if (!content.trim() || isLoading) return
    setText('')

    // Create conversation on first message
    let convId = activeConvId
    if (!convId) {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstMessage: content }),
      })
      const newConv = await res.json()
      convId = newConv.id
      setActiveConvId(convId)
      await loadConversations()
    } else {
      // Save user message to DB
      await fetch(`/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
      // Just persist via the chat route which saves assistant reply; user messages saved at creation
      await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstMessage: content }),
      }).catch(() => {})
    }

    sendMessage(content, context.data, convId ?? undefined)
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(text) }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-112px)] rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-100 bg-gray-50/50">
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center gap-2 rounded-xl bg-[#0D1B2A] text-white px-3 py-2.5 text-sm font-medium hover:bg-[#1B263B] transition-colors"
          >
            <Plus size={15} />
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingConvs ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200/60 animate-pulse" />)
          ) : conversations.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No saved conversations</div>
          ) : conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                'group flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors',
                activeConvId === conv.id ? 'bg-[#0D1B2A]/8 text-gray-900' : 'hover:bg-gray-100 text-gray-600'
              )}
              onClick={() => loadConversation(conv)}
            >
              <MessageSquare size={13} className="mt-0.5 shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(conv.id) }}
                      className="flex-1 text-xs rounded border border-gray-200 px-1.5 py-0.5 outline-none focus:border-[#415A77]"
                      autoFocus
                    />
                    <button onClick={() => saveTitle(conv.id)} className="text-emerald-600 hover:text-emerald-700"><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium truncate leading-tight">{conv.title ?? 'Untitled'}</p>
                    <p className="text-[10px] text-gray-400">{conv._count?.messages ?? 0} messages</p>
                  </>
                )}
              </div>
              {editingId !== conv.id && (
                <div className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditingId(conv.id); setEditTitle(conv.title ?? '') }} className="text-gray-400 hover:text-gray-600 p-0.5"><Edit2 size={11} /></button>
                  <button onClick={() => deleteConversation(conv.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#415A77] to-[#0D1B2A] flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Assistant</p>
              <p className="text-[11px] text-gray-400">Context: {context.label}</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { clearMessages(); setActiveConvId(null) }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
              <div className="h-14 w-14 rounded-full bg-[#0D1B2A]/5 flex items-center justify-center mb-4">
                <Sparkles size={26} className="text-[#415A77]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">What can I help with?</h2>
              <p className="text-sm text-gray-500 mb-7">Ask about contacts, pipeline, tasks, or draft content. I can also create records for you.</p>
              <div className="grid grid-cols-2 gap-2 w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 px-4 py-3 text-sm text-gray-600 text-left transition-colors leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-4">
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e: FormEvent) => { e.preventDefault(); handleSend(text) }}
              className="flex items-end gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-[#415A77]/40 focus-within:ring-1 focus-within:ring-[#415A77]/20 shadow-sm transition-all"
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your CRM…"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none max-h-36 leading-relaxed"
                style={{ minHeight: '22px' }}
              />
              <button
                type="submit"
                disabled={!text.trim() || isLoading}
                className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center transition-all shrink-0',
                  text.trim() && !isLoading ? 'bg-[#0D1B2A] text-white hover:bg-[#1B263B]' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                )}
              >
                <Send size={14} />
              </button>
            </form>
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line · AI may make mistakes
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
