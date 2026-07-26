import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  value: z.number().finite(),
  note: z.string().trim().max(200).nullable().optional(),
})

/** Recent values, newest first — the history shown under each metric. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const limit = Math.min(365, Math.max(1, parseInt(url.searchParams.get('limit') ?? '60', 10)))

  const values = await prisma.customMetricValue.findMany({
    where: { customMetricId: params.id },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return NextResponse.json(values)
}

/**
 * Record a value for one day.
 *
 * Upserts on [customMetricId, date], so re-entering a date corrects it instead
 * of adding a second point — the same idempotency the outbound stats ingest
 * relies on, and the reason a mistyped number is trivially fixable.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const metric = await prisma.customMetric.findUnique({ where: { id: params.id } })
  if (!metric) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body
  try {
    body = upsertSchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : 'Invalid request body'
    return NextResponse.json({ error: message ?? 'Invalid request body' }, { status: 400 })
  }

  const date = new Date(`${body.date}T00:00:00.000Z`)

  const value = await prisma.customMetricValue.upsert({
    where: { customMetricId_date: { customMetricId: params.id, date } },
    create: {
      customMetricId: params.id,
      date,
      value: body.value,
      note: body.note ?? null,
      source: 'MANUAL',
    },
    update: { value: body.value, note: body.note ?? null, source: 'MANUAL' },
  })

  return NextResponse.json(value, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const valueId = url.searchParams.get('valueId')
  if (!valueId) {
    return NextResponse.json({ error: 'valueId is required' }, { status: 400 })
  }

  // Scoped to this metric so a valueId from another metric cannot be deleted
  // by guessing the id.
  const deleted = await prisma.customMetricValue.deleteMany({
    where: { id: valueId, customMetricId: params.id },
  })
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
