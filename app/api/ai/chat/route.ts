import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-6'

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_contacts',
    description: 'Search for contacts in the CRM by name or email.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Name or email to search for' } },
      required: ['query'],
    },
  },
  {
    name: 'get_contact_details',
    description: 'Get full details for a contact including recent activity, tasks, and opportunities.',
    input_schema: {
      type: 'object' as const,
      properties: { contactId: { type: 'string' } },
      required: ['contactId'],
    },
  },
  {
    name: 'get_today_tasks',
    description: 'Get all tasks due today or overdue.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of pipeline stages, opportunity counts, and total values.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'create_task',
    description: 'Create a new task in the CRM. Always confirm with the user before calling this.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        contactId: { type: 'string', description: 'Optional contact ID to link the task to' },
        dueDate: { type: 'string', description: 'ISO date string, e.g. 2026-06-10' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'move_opportunity',
    description: 'Move an opportunity to a different pipeline stage. Always confirm before calling.',
    input_schema: {
      type: 'object' as const,
      properties: {
        opportunityId: { type: 'string' },
        stageName: { type: 'string', description: 'Exact stage name to move to' },
      },
      required: ['opportunityId', 'stageName'],
    },
  },
  {
    name: 'get_recent_activity',
    description: 'Get recent activity logs for a contact or company.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: { type: 'string' },
        limit: { type: 'number', description: 'Max number of activity entries (default 10)' },
      },
    },
  },
]

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  try {
    switch (name) {
      case 'search_contacts': {
        const { query } = input as { query: string }
        const contacts = await prisma.contact.findMany({
          where: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true, leadStatus: true },
          take: 10,
        })
        if (contacts.length === 0) return 'No contacts found matching that search.'
        return contacts.map((c) => `${c.firstName} ${c.lastName} (${c.email ?? 'no email'}) — ${c.leadStatus} [ID: ${c.id}]`).join('\n')
      }

      case 'get_contact_details': {
        const { contactId } = input as { contactId: string }
        const [contact, tasks, activity, opps] = await Promise.all([
          prisma.contact.findUnique({
            where: { id: contactId },
            include: { company: { select: { name: true } } },
          }),
          prisma.task.findMany({
            where: { contactId, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 5,
            select: { title: true, status: true, dueDate: true, priority: true },
          }),
          prisma.activityLog.findMany({
            where: { contactId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { type: true, description: true, createdAt: true },
          }),
          prisma.opportunity.findMany({
            where: { contactId },
            include: { stage: { select: { name: true } } },
            take: 5,
          }),
        ])
        if (!contact) return 'Contact not found.'
        return JSON.stringify({
          contact: { name: `${contact.firstName} ${contact.lastName}`, email: contact.email, phone: contact.phone, company: contact.company?.name, status: contact.leadStatus },
          openTasks: tasks,
          recentActivity: activity,
          opportunities: opps,
        }, null, 2)
      }

      case 'get_today_tasks': {
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        const tasks = await prisma.task.findMany({
          where: { dueDate: { lte: today }, status: { not: 'COMPLETED' } },
          include: { contact: { select: { firstName: true, lastName: true } } },
          orderBy: { dueDate: 'asc' },
          take: 20,
        })
        if (tasks.length === 0) return 'No tasks due today.'
        return tasks.map((t) => `• ${t.title}${t.contact ? ` — ${t.contact.firstName} ${t.contact.lastName}` : ''} [${t.priority}] due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'no date'}`).join('\n')
      }

      case 'get_pipeline_summary': {
        const stages = await prisma.stage.findMany({
          include: {
            opportunities: { where: { outcome: null }, select: { value: true } },
          },
          orderBy: { order: 'asc' },
        })
        return stages.map((s) => {
          const total = s.opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0)
          return `${s.name}: ${s.opportunities.length} deals — $${total.toLocaleString()}`
        }).join('\n')
      }

      case 'create_task': {
        const { title, description, contactId, dueDate, priority } = input as {
          title: string; description?: string; contactId?: string; dueDate?: string; priority?: string
        }
        const task = await prisma.task.create({
          data: {
            title,
            description,
            contactId: contactId ?? null,
            dueDate: dueDate ? new Date(dueDate) : null,
            priority: (priority as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
            status: 'TODO',
          },
        })
        return `Task created: "${task.title}" [ID: ${task.id}]${dueDate ? ` due ${dueDate}` : ''}`
      }

      case 'move_opportunity': {
        const { opportunityId, stageName } = input as { opportunityId: string; stageName: string }
        const stage = await prisma.stage.findFirst({ where: { name: { equals: stageName, mode: 'insensitive' } } })
        if (!stage) return `Stage "${stageName}" not found. Available stages: check /pipeline.`
        await prisma.opportunity.update({ where: { id: opportunityId }, data: { stageId: stage.id } })
        return `Opportunity moved to "${stage.name}" successfully.`
      }

      case 'get_recent_activity': {
        const { contactId, limit = 10 } = input as { contactId?: string; limit?: number }
        const activity = await prisma.activityLog.findMany({
          where: contactId ? { contactId } : {},
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: { contact: { select: { firstName: true, lastName: true } } },
        })
        if (activity.length === 0) return 'No recent activity.'
        return activity.map((a) => `[${new Date(a.createdAt).toLocaleDateString()}] ${a.description}${a.contact ? ` — ${a.contact.firstName} ${a.contact.lastName}` : ''}`).join('\n')
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Tool error: ${String(err)}`
  }
}

function buildSystemPrompt(context: Record<string, unknown> | null): string {
  const base = `You are an AI assistant embedded in a CRM system. You help sales teams manage contacts, deals, tasks, and communications.

You have access to tools to search contacts, view pipeline data, check tasks, and create/update records.

Guidelines:
- Be concise and direct. Avoid unnecessary preamble.
- Before creating or modifying any record (create_task, move_opportunity), you MUST ask the user to confirm first. Only call those tools after the user says "yes" or "confirm".
- When drafting emails or messages, format them with Subject: and Body: sections.
- After using a tool, summarize what you found in plain language — do not dump raw JSON to the user.
- If the user asks you to do something you can't do (e.g. send an actual email), explain what you CAN do (draft the content).`

  if (!context || Object.keys(context).length === 0) return base

  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n')

  return `${base}\n\nCurrent page context:\n${contextStr}`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, context, conversationId } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    context: Record<string, unknown> | null
    conversationId?: string
  }

  const systemPrompt = buildSystemPrompt(context)
  const encoder = new TextEncoder()

  function emit(controller: ReadableStreamDefaultController, obj: unknown) {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        let fullAssistantText = ''

        for (let round = 0; round < 6; round++) {
          const aiStream = anthropic.messages.stream({
            model: MODEL,
            system: systemPrompt,
            messages: currentMessages,
            tools: TOOLS,
            max_tokens: 2048,
          })

          for await (const event of aiStream) {
            if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              emit(controller, { type: 'tool_start', name: event.content_block.name })
            }
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullAssistantText += event.delta.text
              emit(controller, { type: 'text', content: event.delta.text })
            }
          }

          const finalMsg = await aiStream.finalMessage()

          if (finalMsg.stop_reason !== 'tool_use') break

          // Execute tools
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of finalMsg.content) {
            if (block.type !== 'tool_use') continue
            const result = await executeTool(block.name, block.input as Record<string, unknown>, session.user.id)
            emit(controller, { type: 'tool_result', name: block.name, result })
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }

          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: finalMsg.content },
            { role: 'user', content: toolResults },
          ]
        }

        // Persist to DB if conversationId provided
        if (conversationId && fullAssistantText) {
          await prisma.aIMessage.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullAssistantText,
            },
          })
        }

        emit(controller, { type: 'done' })
        controller.close()
      } catch (err) {
        emit(controller, { type: 'error', message: String(err) })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
