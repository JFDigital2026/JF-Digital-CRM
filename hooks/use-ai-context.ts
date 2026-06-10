'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export type AIPageContext = {
  label: string
  data: Record<string, unknown>
}

export function useAIContext(): AIPageContext {
  const pathname = usePathname()
  const [context, setContext] = useState<AIPageContext>({ label: 'CRM Dashboard', data: {} })

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean)

    // /contacts/[id]
    if (segments[0] === 'contacts' && segments[1] && segments[1] !== 'new') {
      const id = segments[1]
      fetch(`/api/contacts/${id}`)
        .then((r) => r.json())
        .then((contact) => {
          if (!contact || contact.error) return
          setContext({
            label: `${contact.firstName} ${contact.lastName} — Contact`,
            data: {
              contactId: id,
              contactName: `${contact.firstName} ${contact.lastName}`,
              email: contact.email,
              phone: contact.phone,
              leadStatus: contact.leadStatus,
              company: contact.company?.name,
              source: contact.source,
              tags: contact.tags?.join(', '),
            },
          })
        })
        .catch(() => {})
      return
    }

    // /companies/[id]
    if (segments[0] === 'companies' && segments[1] && segments[1] !== 'new') {
      const id = segments[1]
      fetch(`/api/companies/${id}`)
        .then((r) => r.json())
        .then((company) => {
          if (!company || company.error) return
          setContext({
            label: `${company.name} — Company`,
            data: {
              companyId: id,
              companyName: company.name,
              industry: company.industry,
              website: company.website,
              lastProjectSummary: company.lastProjectSummary,
            },
          })
        })
        .catch(() => {})
      return
    }

    // /pipeline or /opportunities
    if (segments[0] === 'pipeline' || segments[0] === 'opportunities') {
      fetch('/api/metrics/pipeline')
        .then((r) => r.json())
        .then((data) => {
          const stages = data?.valueByStage ?? []
          setContext({
            label: 'Pipeline View',
            data: {
              page: 'Pipeline',
              stagesCount: stages.length,
              totalPipelineValue: stages.reduce((s: number, st: { value: number }) => s + (st.value ?? 0), 0),
            },
          })
        })
        .catch(() => {})
      return
    }

    // /tasks
    if (segments[0] === 'tasks') {
      setContext({ label: 'Tasks', data: { page: 'Tasks', hint: 'User is viewing the tasks page' } })
      return
    }

    // /dashboard
    if (segments[0] === 'dashboard' || segments.length === 0) {
      setContext({ label: 'Dashboard', data: { page: 'Dashboard' } })
      return
    }

    // /metrics
    if (segments[0] === 'metrics') {
      setContext({ label: 'Metrics', data: { page: 'Metrics & Analytics' } })
      return
    }

    // /inbox
    if (segments[0] === 'inbox') {
      setContext({ label: 'Inbox', data: { page: 'Inbox / Conversations' } })
      return
    }

    setContext({ label: 'CRM', data: { page: segments[0] ?? 'Dashboard' } })
  }, [pathname])

  return context
}

export function buildSuggestedPrompts(context: AIPageContext): string[] {
  const base = [
    "What tasks are due today?",
    "Give me a pipeline summary",
    "How many contacts were added this month?",
  ]

  if (context.data.contactName) {
    const name = context.data.contactName as string
    return [
      `Draft a follow-up email for ${name}`,
      `Summarize ${name}'s recent activity`,
      `Create a task for ${name} due Friday`,
      `What opportunities does ${name} have?`,
    ]
  }

  if (context.data.companyName) {
    const name = context.data.companyName as string
    return [
      `Summarize the current status of ${name}`,
      `Who are the contacts at ${name}?`,
      `Draft a follow-up email for ${name}`,
      `What's the last project note for ${name}?`,
    ]
  }

  if (context.data.page === 'Pipeline') {
    return [
      "Which stage has the most value?",
      "What deals need attention?",
      "Summarize this week's pipeline movement",
      "Which opportunities are at risk?",
    ]
  }

  if (context.data.page === 'Tasks') {
    return [
      "What tasks are overdue?",
      "Create a task for tomorrow",
      "Summarize today's priorities",
      "Which contacts have no follow-up tasks?",
    ]
  }

  return base
}
