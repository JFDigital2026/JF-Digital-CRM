import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'automations:trigger')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { automationId, trigger, contactId, payload } = body

  if (!automationId && !trigger) {
    return err('VALIDATION_ERROR', 'automationId or trigger is required')
  }

  const automation = await prisma.automation.findFirst({
    where: {
      userId: auth.userId,
      active: true,
      ...(automationId ? { id: automationId } : { trigger }),
    },
  })

  if (!automation) return err('NOT_FOUND', 'Automation not found or inactive', 404)

  const queueEntry = await prisma.automationQueue.create({
    data: {
      automationId: automation.id,
      contactId: contactId ?? null,
      status: 'PENDING',
      actionPayload: payload ?? {},
      executeAt: new Date(),
    },
  })

  return ok({ queued: true, queueId: queueEntry.id, automationId: automation.id }, undefined, 202)
}
