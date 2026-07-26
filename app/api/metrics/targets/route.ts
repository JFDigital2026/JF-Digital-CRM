import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import { isKnownMetricAsync } from '@/lib/metrics/registry'

const putSchema = z.object({
  metricId: z.string().min(1),
  value: z.number().finite().nullable(),
  period: z.enum(['month', 'quarter', 'year', 'total']).optional().default('month'),
})

export async function GET() {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const targets = await prisma.metricTarget.findMany({ orderBy: { metricId: 'asc' } })
  return NextResponse.json(targets)
}

/** Upsert one target. A null value clears it. */
export async function PUT(req: Request) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  let body
  try {
    body = putSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!(await isKnownMetricAsync(body.metricId))) {
    return NextResponse.json({ error: 'Unknown metric' }, { status: 400 })
  }

  if (body.value === null) {
    await prisma.metricTarget.deleteMany({ where: { metricId: body.metricId } })
    return NextResponse.json({ success: true, cleared: true })
  }

  const target = await prisma.metricTarget.upsert({
    where: { metricId: body.metricId },
    create: { metricId: body.metricId, value: body.value, period: body.period },
    update: { value: body.value, period: body.period },
  })

  return NextResponse.json(target)
}
