'use client'

import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Send, Trash2, Wrench, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAI, type ChatMessage } from '@/components/ai/ai-provider'
import { useAIContext, buildSuggestedPrompts } from '@/hooks/use-ai-context'
import { cn } from '@/lib/utils'

// ─── Message bubbles ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </span>
  )
}

function ToolBadge({ name, result }: { name: string; result?: string }) {
  const [expanded, setExpanded] = useState(false)
  const labels: Record<string, string> = {
    search_contacts: 'Searching contacts',
    get_contact_details: 'Getting contact details',
    get_today_tasks: 'Checking today\'s tasks',
    get_pipeline_summary: 'Loading pipeline',
    create_task: 'Creating task',
    move_opportunity: 'Moving opportunity',
    get_recent_activity: 'Getting activity',
  }
  const label = labels[name] ?? name
  return (
    <div className="mt-1.5">
      <button
        onClick={() => result && setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
          result
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
            : 'border-amber-200 bg-amber-50 text-amber-700 animate-pulse cursor-default'
        )}
      >
        <Wrench size={10} />
        {result ? `✓ ${label}` : `${label}…`}
        {result && <ChevronRight size={10} className={cn('transition-transform', expanded && 'rotate-90')} />}
      </button>
      {expanded && result && (
        <pre className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-gray-50 border border-gray-100 p-2 text-[10px] text-gray-600 whitespace-pre-wrap break-words">
          {result}
        </pre>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#0D1B2A] px-3.5 py-2.5 text-sm text-white leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#415A77] to-[#0D1B2A] flex items-center justify-center text-[9px] font-bold text-white mt-0.5">
        AI
      </div>
      <div className="flex-1 min-w-0">
        {msg.toolEvents?.map((te, i) => (
          <ToolBadge key={i} name={te.name} result={te.result} />
        ))}
        <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed mt-1.5 whitespace-pre-wrap break-words">
          {msg.isStreaming && !msg.content ? <TypingDots /> : msg.content || <TypingDots />}
        </div>
      </div>
    </div>
  )
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onClear,
  disabled,
}: {
  onSend: (text: string) => void
  onClear: () => void
  disabled: boolean
}) {
  const [text, setText] = useState('')

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-100 p-3">
      <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-[#415A77]/40 focus-within:ring-1 focus-within:ring-[#415A77]/20 transition-all">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your CRM…"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none max-h-28 leading-relaxed"
          style={{ minHeight: '22px' }}
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="text-gray-300 hover:text-gray-500 transition-colors p-1"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="submit"
            disabled={!text.trim() || disabled}
            className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center transition-all',
              text.trim() && !disabled
                ? 'bg-[#0D1B2A] text-white hover:bg-[#1B263B]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            )}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
    </form>
  )
}

// ─── Floating button + panel ─────────────────────────────────────────────────

export function AIFloatingButton() {
  const pathname = usePathname()
  const { isOpen, close, toggle, messages, isLoading, sendMessage, clearMessages } = useAI()
  const context = useAIContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hidden = pathname === '/ai-assistant'

  // Auto-scroll
  useEffect(() => {
    if (hidden) return
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, hidden])

  // Click outside to close
  useEffect(() => {
    if (hidden) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = document.getElementById('ai-fab')
        if (btn && btn.contains(e.target as Node)) return
        close()
      }
    }
    if (isOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen, close])

  const suggestions = buildSuggestedPrompts(context)

  function handleSend(text: string) {
    sendMessage(text, context.data)
  }

  const isEmpty = messages.length === 0

  // All hooks are above — safe to bail out here
  if (hidden) return null

  return (
    <>
      {/* Floating button */}
      <button
        id="ai-fab"
        onClick={toggle}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-13 w-13 rounded-full bg-[#0D1B2A] text-white shadow-lg',
          'flex items-center justify-center transition-all hover:bg-[#1B263B] hover:scale-105 active:scale-95',
          !isOpen && 'animate-[pulse_3s_ease-in-out_infinite]'
        )}
        style={{ height: 52, width: 52 }}
        aria-label="Open AI Assistant"
      >
        {isOpen ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      {/* Side panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            key="ai-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-40 w-[400px] flex flex-col bg-white border-l border-gray-100 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-[#0D1B2A]">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI Assistant</p>
                  <p className="text-[10px] text-white/50 leading-none">{context.label}</p>
                </div>
              </div>
              <button onClick={close} className="text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-0">
              {isEmpty && (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-[#0D1B2A]/5 flex items-center justify-center mb-4">
                    <Sparkles size={22} className="text-[#415A77]" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">How can I help?</p>
                  <p className="text-xs text-gray-400 mb-5">Ask about contacts, create tasks, or get pipeline insights.</p>
                  <div className="w-full space-y-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 px-3 py-2.5 text-xs text-gray-600 transition-colors leading-relaxed"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>

            {/* Input */}
            <ChatInput onSend={handleSend} onClear={clearMessages} disabled={isLoading} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
