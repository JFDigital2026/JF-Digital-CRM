import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { testAutomation } from '@/lib/automation-engine'
import type { AutomationDefinition } from '@/lib/automation-types'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automation = await prisma.automation.findUnique({ where: { id: params.id } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { contactId } = await req.json()
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

  const definition: AutomationDefinition = {
    name: automation.name,
    trigger: automation.trigger as AutomationDefinition['trigger'],
    triggerConfig: (automation.triggerConfig ?? {}) as Record<string, unknown>,
    conditions: (automation.conditions as unknown as AutomationDefinition['conditions']) ?? [],
    steps: automation.steps as unknown as AutomationDefinition['steps'],
  }
  const copyOverrides = (automation.copyOverrides ?? {}) as Record<string, Record<string, string>>

  try {
    const stepLogs = await testAutomation(definition, contactId, copyOverrides)
    return NextResponse.json({ stepLogs })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Test failed' }, { status: 500 })
  }
}
