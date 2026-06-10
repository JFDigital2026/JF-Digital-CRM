'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolEvents?: { name: string; result?: string }[]
  isStreaming?: boolean
}

type AIContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (content: string, context: Record<string, unknown> | null, conversationId?: string) => Promise<void>
  clearMessages: () => void
  setMessages: (msgs: ChatMessage[]) => void
}

const AIContext = createContext<AIContextValue | null>(null)

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('useAI must be used inside AIProvider')
  return ctx
}

let msgCounter = 0
function nextId() { return `msg-${++msgCounter}` }

export function AIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const clearMessages = useCallback(() => setMessages([]), [])

  const sendMessage = useCallback(async (
    content: string,
    context: Record<string, unknown> | null,
    conversationId?: string
  ) => {
    if (isLoading) return

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content }
    const assistantId = nextId()

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ])
    setIsLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Build message history (exclude the empty assistant placeholder)
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context, conversationId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error('Failed to connect')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as { type: string; content?: string; name?: string; result?: string; message?: string }

            if (event.type === 'text' && event.content) {
              fullText += event.content
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText, isStreaming: true } : m
                )
              )
            }

            if (event.type === 'tool_start') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolEvents: [...(m.toolEvents ?? []), { name: event.name! }] }
                    : m
                )
              )
            }

            if (event.type === 'tool_result') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolEvents: (m.toolEvents ?? []).map((te) =>
                          te.name === event.name && !te.result ? { ...te, result: event.result } : te
                        ),
                      }
                    : m
                )
              )
            }

            if (event.type === 'done' || event.type === 'error') {
              const errorContent = event.type === 'error' ? `Error: ${event.message}` : undefined
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: errorContent ?? m.content, isStreaming: false }
                    : m
                )
              )
              break
            }
          } catch { /* malformed line */ }
        }
      }

      // Final cleanup — mark streaming done
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong. Please try again.', isStreaming: false }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages])

  return (
    <AIContext.Provider value={{ isOpen, open, close, toggle, messages, isLoading, sendMessage, clearMessages, setMessages }}>
      {children}
    </AIContext.Provider>
  )
}
