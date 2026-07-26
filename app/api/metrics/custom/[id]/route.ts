import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import {
  VALID_AGGREGATIONS,
  VALID_CATEGORIES,
  VALID_UNITS,
  customMetricId,
} from '@/lib/metrics/custom'
import { invalidateCustomMetricCache } from '@/lib/metrics/custom-server'

const updateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(280).optional(),
  unit: z.enum(VALID_UNITS as [string, ...string[]]).optional(),
  category: z.enum(VALID_CATEGORIES as unknown as [string, ...string[]]).optional(),
  aggregation: z.enum(VALID_AGGREGATIONS as [string, ...string[]]).optional(),
  higherIsBetter: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const metric = await prisma.customMetric.findUnique({
    where: { id: params.id },
    include: { _count: { select: { values: true } } },
  })
  if (!metric) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...metric, metricId: customMetricId(metric.key) })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const existing = await prisma.customMetric.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body
  try {
    body = updateSchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : 'Invalid request body'
    return NextResponse.json({ error: message ?? 'Invalid request body' }, { status: 400 })
  }

  // The key is deliberately immutable. It is embedded in the metric id stored on
  // every view item that references this metric; renaming it would orphan them
  // all. The label is free to change.
  const metric = await prisma.customMetric.update({
    where: { id: params.id },
    data: {
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.aggregation !== undefined
        ? { aggregation: body.aggregation as 'SUM' | 'AVERAGE' | 'LATEST' | 'MAX' | 'MIN' }
        : {}),
      ...(body.higherIsBetter !== undefined ? { higherIsBetter: body.higherIsBetter } : {}),
    },
    include: { _count: { select: { values: true } } },
  })

  invalidateCustomMetricCache()

  return NextResponse.json({ ...metric, metricId: customMetricId(metric.key) })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const existing = await prisma.customMetric.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const metricId = customMetricId(existing.key)

  // Values cascade with the metric. View items and any target referencing it are
  // cleaned up here, so no view is left holding a dangling id. (A leftover id
  // would still render safely as an "unavailable" card, but silently carrying
  // dead references makes views harder to reason about.)
  const [, removedItems] = await prisma.$transaction([
    prisma.metricTarget.deleteMany({ where: { metricId } }),
    prisma.metricViewItem.deleteMany({ where: { metricId } }),
    prisma.customMetric.delete({ where: { id: params.id } }),
  ])

  invalidateCustomMetricCache()

  return NextResponse.json({
    success: true,
    removedFromViews: removedItems.count,
  })
}
