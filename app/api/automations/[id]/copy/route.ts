import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { COPY_EDITABLE_TYPES } from '@/lib/automation-types'

// PATCH /api/automations/[id]/copy
// Body: { stepId: string, fields: { subject?: string, body?: string, title?: string, description?: string } }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automation = await prisma.automation.findUnique({ where: { id: params.id } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { stepId, fields } = body as { stepId: string; fields: Record<string, string> }

  if (!stepId || !fields) return NextResponse.json({ error: 'stepId and fields required' }, { status: 400 })

  // Verify the step exists and is copy-editable
  const steps = automation.steps as unknown as Array<{ id: string; type: string }>
  const step = steps.find((s) => s.id === stepId)
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })
  if (!COPY_EDITABLE_TYPES.includes(step.type as typeof COPY_EDITABLE_TYPES[number])) {
    return NextResponse.json({ error: 'This step type does not support copy editing' }, { status: 400 })
  }

  const existing = (automation.copyOverrides ?? {}) as Record<string, Record<string, string>>
  const updated = {
    ...existing,
    [stepId]: { ...(existing[stepId] ?? {}), ...fields },
  }

  const result = await prisma.automation.update({
    where: { id: params.id },
    data: { copyOverrides: JSON.parse(JSON.stringify(updated)) },
  })

  return NextResponse.json({ copyOverrides: result.copyOverrides })
}

// GET — return just the copy overrides for a given automation
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automation = await prisma.automation.findUnique({
    where: { id: params.id },
    select: { copyOverrides: true },
  })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ copyOverrides: automation.copyOverrides ?? {} })
}
