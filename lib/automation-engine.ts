import { prisma } from './prisma'
import type {
  AutomationCondition,
  AutomationDefinition,
  AutomationStep,
  StepLog,
  TriggerType,
  EmailConfig,
  SmsConfig,
  TaskConfig,
  TagConfig,
  WaitConfig,
  BranchConfig,
  StageMoveConfig,
  WebhookConfig,
} from './automation-types'
import { interpolate } from './automation-types'

// ─── Contact context builder ───────────────────────────────────────────────────

export async function buildStepContext(contactId: string): Promise<Record<string, unknown> | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { company: { select: { name: true } } },
  })
  if (!contact) return null
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    leadStatus: contact.leadStatus,
    tags: contact.tags,
    companyId: contact.companyId,
    company: contact.company?.name,
    source: contact.source,
    createdAt: contact.createdAt.toISOString(),
  }
}

// ─── Condition evaluator ───────────────────────────────────────────────────────

function evaluateCondition(
  condition: AutomationCondition,
  contact: Record<string, unknown>
): boolean {
  const raw = contact[condition.field]
  const val = raw == null ? '' : String(raw)
  const target = condition.value ?? ''

  switch (condition.operator) {
    case 'equals':       return val.toLowerCase() === target.toLowerCase()
    case 'not_equals':   return val.toLowerCase() !== target.toLowerCase()
    case 'contains':     return val.toLowerCase().includes(target.toLowerCase())
    case 'not_contains': return !val.toLowerCase().includes(target.toLowerCase())
    case 'exists':       return raw != null && raw !== '' && !(Array.isArray(raw) && raw.length === 0)
    case 'not_exists':   return raw == null || raw === ''
    case 'greater_than': return parseFloat(val) > parseFloat(target)
    case 'less_than':    return parseFloat(val) < parseFloat(target)
    default:             return false
  }
}

// ─── Step executor ─────────────────────────────────────────────────────────────

async function executeStep(
  step: AutomationStep,
  contact: Record<string, unknown>,
  automationId: string,
  testMode: boolean,
  copyOverrides: Record<string, Record<string, string>>
): Promise<Omit<StepLog, 'stepId' | 'stepLabel' | 'type'> & { nextStepId?: string; halt?: boolean }> {
  const t0 = Date.now()

  // Apply copy overrides if present
  const overriddenConfig = copyOverrides[step.id]
    ? { ...step.config, ...copyOverrides[step.id] }
    : step.config

  try {
    switch (step.type) {
      case 'EMAIL': {
        const cfg = overriddenConfig as EmailConfig
        const subject = interpolate(cfg.subject ?? '', contact)
        const body = interpolate(cfg.body ?? '', contact)
        const email = contact.email as string | null

        if (!testMode && email) {
          try {
            const { Resend } = await import('resend')
            const resend = new Resend(process.env.RESEND_API_KEY)
            await resend.emails.send({
              from: process.env.EMAIL_FROM ?? 'noreply@example.com',
              to: email,
              subject,
              html: body.replace(/\n/g, '<br>'),
            })
          } catch (err) {
            console.error('[Engine] Email send failed:', err)
          }
        }

        return {
          status: 'success',
          detail: testMode
            ? `Would send email to ${email ?? '(no email)'} — Subject: "${subject}"`
            : `Email sent to ${email ?? '(no email)'} — "${subject}"`,
          durationMs: Date.now() - t0,
        }
      }

      case 'SMS': {
        const cfg = overriddenConfig as SmsConfig
        const body = interpolate(cfg.body ?? '', contact)
        const phone = contact.phone as string | null

        if (!testMode && phone) {
          try {
            const twilio = (await import('twilio')).default
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
            await client.messages.create({
              body,
              from: process.env.TWILIO_PHONE_NUMBER ?? '',
              to: phone,
            })
          } catch (err) {
            console.error('[Engine] SMS send failed:', err)
          }
        }

        return {
          status: 'success',
          detail: testMode
            ? `Would send SMS to ${phone ?? '(no phone)'} — "${body.slice(0, 60)}${body.length > 60 ? '…' : ''}"`
            : `SMS sent to ${phone ?? '(no phone)'}`,
          durationMs: Date.now() - t0,
        }
      }

      case 'WAIT': {
        const cfg = overriddenConfig as WaitConfig
        const dur = cfg.duration ?? 1
        const unit = cfg.unit ?? 'days'

        if (testMode) {
          return {
            status: 'skipped',
            detail: `Skipped: ${dur} ${unit} wait`,
            durationMs: Date.now() - t0,
          }
        }

        // Queue: halt = true tells the engine to stop here
        const multiplier = unit === 'hours' ? 3600_000 : unit === 'business_days' ? 86400_000 * 1.4 : 86400_000
        const executeAt = new Date(Date.now() + dur * multiplier)
        return {
          status: 'success',
          detail: `Queued ${dur} ${unit} wait — resumes at ${executeAt.toISOString()}`,
          durationMs: Date.now() - t0,
          halt: true,
        }
      }

      case 'TASK': {
        const cfg = overriddenConfig as TaskConfig
        const title = interpolate(cfg.title ?? 'Follow up', contact)
        const description = cfg.description ? interpolate(cfg.description, contact) : null
        const dueDate = cfg.dueDays != null
          ? new Date(Date.now() + cfg.dueDays * 86400_000)
          : null

        if (!testMode) {
          await prisma.task.create({
            data: {
              title,
              description,
              status: 'TODO',
              priority: (cfg.priority as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
              contactId: (contact.id as string) || null,
              companyId: (contact.companyId as string) || null,
              dueDate,
            },
          })
        } else {
          // Create a test task tagged for easy cleanup
          await prisma.task.create({
            data: {
              title: `[TEST] ${title}`,
              description,
              status: 'TODO',
              priority: (cfg.priority as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
              contactId: (contact.id as string) || null,
              dueDate,
            },
          })
        }

        return {
          status: 'success',
          detail: testMode ? `Test task created: "${title}"` : `Task created: "${title}"`,
          durationMs: Date.now() - t0,
        }
      }

      case 'TAG': {
        const cfg = overriddenConfig as TagConfig
        const tag = cfg.tag ?? ''
        if (!testMode && contact.id) {
          const current = await prisma.contact.findUnique({
            where: { id: contact.id as string },
            select: { tags: true },
          })
          if (current) {
            const tags = current.tags ?? []
            const updated = cfg.action === 'remove'
              ? tags.filter((t) => t !== tag)
              : tags.includes(tag) ? tags : [...tags, tag]
            await prisma.contact.update({
              where: { id: contact.id as string },
              data: { tags: updated },
            })
          }
        }
        return {
          status: 'success',
          detail: testMode
            ? `Would ${cfg.action === 'remove' ? 'remove tag' : 'add tag'} "${tag}"`
            : `Tag "${tag}" ${cfg.action === 'remove' ? 'removed' : 'added'}`,
          durationMs: Date.now() - t0,
        }
      }

      case 'STAGE_MOVE': {
        const cfg = overriddenConfig as StageMoveConfig
        if (!testMode && contact.id) {
          const stage = await prisma.stage.findFirst({
            where: { name: { equals: cfg.stageName, mode: 'insensitive' } },
          })
          if (stage) {
            await prisma.opportunity.updateMany({
              where: { contactId: contact.id as string },
              data: { stageId: stage.id },
            })
          }
        }
        return {
          status: 'success',
          detail: testMode ? `Would move to stage "${cfg.stageName}"` : `Moved to stage "${cfg.stageName}"`,
          durationMs: Date.now() - t0,
        }
      }

      case 'WEBHOOK': {
        const cfg = overriddenConfig as WebhookConfig
        if (!testMode) {
          const res = await fetch(cfg.url, {
            method: cfg.method ?? 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg.payload ?? { contactId: contact.id }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
        }
        return {
          status: 'success',
          detail: testMode ? `Would POST to ${cfg.url}` : `Webhook sent to ${cfg.url}`,
          durationMs: Date.now() - t0,
        }
      }

      case 'BRANCH': {
        const cfg = overriddenConfig as BranchConfig
        const met = evaluateCondition(cfg.condition, contact)
        return {
          status: 'success',
          detail: `Condition: ${cfg.condition.field} ${cfg.condition.operator} "${cfg.condition.value ?? ''}" → ${met ? 'YES' : 'NO'}`,
          durationMs: Date.now() - t0,
          nextStepId: met ? cfg.yes : cfg.no,
        }
      }

      default:
        return { status: 'skipped', detail: 'Unknown step type', durationMs: Date.now() - t0 }
    }
  } catch (err) {
    return {
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    }
  }
}

// ─── Step graph executor ───────────────────────────────────────────────────────

export async function executeFromStep(
  startStepId: string,
  definition: AutomationDefinition,
  copyOverrides: Record<string, Record<string, string>>,
  contact: Record<string, unknown>,
  automationId: string,
  testMode: boolean,
  visited: Set<string>
): Promise<StepLog[]> {
  const logs: StepLog[] = []
  const stepMap = new Map<string, AutomationStep>()
  const stepOrder: string[] = []

  for (const step of definition.steps) {
    stepMap.set(step.id, step)
    stepOrder.push(step.id)
  }

  let currentStepId: string | undefined = startStepId

  while (currentStepId) {
    if (visited.has(currentStepId)) break // cycle guard
    visited.add(currentStepId)

    const step = stepMap.get(currentStepId)
    if (!step) break

    const result = await executeStep(step, contact, automationId, testMode, copyOverrides)
    logs.push({
      stepId: step.id,
      stepLabel: step.label,
      type: step.type,
      status: result.status,
      detail: result.detail,
      durationMs: result.durationMs,
    })

    if (step.type === 'BRANCH') {
      // Jump to the yes/no target
      currentStepId = result.nextStepId
      continue
    }

    if (step.type === 'WAIT') {
      if (!testMode && result.halt) {
        // Find next step in array order and queue it
        const currentIdx = stepOrder.indexOf(currentStepId)
        const nextId = currentIdx >= 0 && currentIdx < stepOrder.length - 1
          ? stepOrder[currentIdx + 1]
          : undefined

        if (nextId) {
          const cfg = step.config as WaitConfig
          const dur = cfg.duration ?? 1
          const unit = cfg.unit ?? 'days'
          const multiplier = unit === 'hours' ? 3600_000 : unit === 'business_days' ? 86400_000 * 1.4 : 86400_000
          const executeAt = new Date(Date.now() + dur * multiplier)

          await prisma.automationQueue.create({
            data: {
              automationId,
              contactId: (contact.id as string) ?? null,
              nextStepId: nextId,
              actionPayload: {},
              executeAt,
            },
          })
        }
      }
      // Stop execution here — will resume from queue
      if (!testMode) break
      // In test mode: continue to next step in sequence
      const currentIdx = stepOrder.indexOf(currentStepId)
      currentStepId = currentIdx >= 0 && currentIdx < stepOrder.length - 1
        ? stepOrder[currentIdx + 1]
        : undefined
      continue
    }

    // Normal step: advance to next in sequence
    const currentIdx = stepOrder.indexOf(currentStepId)
    currentStepId = currentIdx >= 0 && currentIdx < stepOrder.length - 1
      ? stepOrder[currentIdx + 1]
      : undefined
  }

  return logs
}

// ─── Public trigger function ───────────────────────────────────────────────────

export async function triggerAutomation(
  trigger: TriggerType,
  contactId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const contact = await buildStepContext(contactId)
    if (!contact) return

    // Merge metadata into contact context
    const ctx = { ...contact, ...metadata }

    const automations = await prisma.automation.findMany({
      where: { trigger, active: true },
    })

    for (const automation of automations) {
      const definition: AutomationDefinition = {
        name: automation.name,
        trigger: automation.trigger as TriggerType,
        triggerConfig: (automation.triggerConfig ?? {}) as Record<string, unknown>,
        conditions: (automation.conditions as unknown as AutomationDefinition['conditions']) ?? [],
        steps: automation.steps as unknown as AutomationDefinition['steps'],
      }
      const copyOverrides = (automation.copyOverrides ?? {}) as Record<string, Record<string, string>>

      // Evaluate conditions
      const conditionsMet = (definition.conditions ?? []).every((c) => evaluateCondition(c, ctx))
      if (!conditionsMet) continue

      // Check triggerConfig filters (e.g. source: "cold-outreach")
      if (definition.triggerConfig && Object.keys(definition.triggerConfig).length > 0) {
        const passes = Object.entries(definition.triggerConfig).every(([k, v]) => {
          return ctx[k] === v || metadata[k] === v
        })
        if (!passes) continue
      }

      if (definition.steps.length === 0) continue
      const firstStepId = definition.steps[0].id

      const t0 = Date.now()
      const stepLogs = await executeFromStep(
        firstStepId,
        definition,
        copyOverrides,
        ctx,
        automation.id,
        false,
        new Set()
      )
      const duration = Date.now() - t0
      const failed = stepLogs.filter((l) => l.status === 'error')

      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          contactId,
          status: failed.length ? 'FAILURE' : 'SUCCESS',
          stepsCompleted: stepLogs.filter((l) => l.status === 'success').length,
          duration,
          stepLogs: JSON.parse(JSON.stringify(stepLogs)),
        },
      })

      await prisma.automation.update({
        where: { id: automation.id },
        data: { lastRunAt: new Date() },
      })

      if (failed.length) {
        const user = await prisma.user.findFirst()
        if (user) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'AUTOMATION_FAILED',
              title: `Automation failed: ${automation.name}`,
              body: failed.map((l) => l.detail).join('; '),
              linkUrl: `/automations/${automation.id}/logs`,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('[AutomationEngine] triggerAutomation error:', err)
  }
}

// ─── Test runner ───────────────────────────────────────────────────────────────

export async function testAutomation(
  definition: AutomationDefinition,
  contactId: string,
  copyOverrides: Record<string, Record<string, string>>
): Promise<StepLog[]> {
  const contact = await buildStepContext(contactId)
  if (!contact) throw new Error('Contact not found')

  if (definition.steps.length === 0) return []
  const firstStepId = definition.steps[0].id

  return executeFromStep(
    firstStepId,
    definition,
    copyOverrides,
    contact,
    'test',
    true,
    new Set()
  )
}
