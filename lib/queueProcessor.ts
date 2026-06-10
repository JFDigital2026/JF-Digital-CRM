import { prisma } from './prisma'
import type { AutomationDefinition } from './automation-types'

let processorStarted = false

export async function processQueue(): Promise<{ processed: number }> {
  const due = await prisma.automationQueue.findMany({
    where: { status: 'PENDING', executeAt: { lte: new Date() } },
    include: { automation: true },
    take: 100,
  })

  let processed = 0
  for (const item of due) {
    try {
      await prisma.automationQueue.update({ where: { id: item.id }, data: { status: 'COMPLETED' } })

      if (item.nextStepId && item.automation && item.contactId) {
        const { executeFromStep, buildStepContext } = await import('./automation-engine')
        const def: AutomationDefinition = {
          name: item.automation.name,
          trigger: item.automation.trigger as AutomationDefinition['trigger'],
          triggerConfig: (item.automation.triggerConfig ?? {}) as Record<string, unknown>,
          conditions: (item.automation.conditions as unknown as AutomationDefinition['conditions']) ?? [],
          steps: item.automation.steps as unknown as AutomationDefinition['steps'],
        }
        const copyOverrides = (item.automation.copyOverrides ?? {}) as Record<string, Record<string, string>>
        const contact = await buildStepContext(item.contactId)
        if (contact) {
          const stepLogs = await executeFromStep(
            item.nextStepId,
            def,
            copyOverrides,
            contact,
            item.automation.id,
            false,
            new Set()
          )

          const failed = stepLogs.filter((l) => l.status === 'error')
          await prisma.automationLog.create({
            data: {
              automationId: item.automation.id,
              contactId: item.contactId,
              status: failed.length ? 'FAILURE' : 'SUCCESS',
              stepsCompleted: stepLogs.filter((l) => l.status === 'success').length,
              stepLogs: JSON.parse(JSON.stringify(stepLogs)),
            },
          })
        }
      }
      processed++
    } catch (err) {
      await prisma.automationQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
      console.error('[QueueProcessor] item failed:', item.id, err)
    }
  }

  return { processed }
}

export function startQueueProcessor() {
  if (processorStarted) return
  processorStarted = true
  setInterval(async () => {
    try {
      const { processed } = await processQueue()
      if (processed > 0) console.log(`[QueueProcessor] Processed ${processed} queued items`)
    } catch (err) {
      console.error('[QueueProcessor] Error:', err)
    }
  }, 60_000)
  console.log('[QueueProcessor] Started (60s interval)')
}
