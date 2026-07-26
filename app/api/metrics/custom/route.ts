import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import {
  VALID_AGGREGATIONS,
  VALID_CATEGORIES,
  VALID_UNITS,
  customMetricId,
  slugifyMetricKey,
} from '@/lib/metrics/custom'
import { invalidateCustomMetricCache } from '@/lib/metrics/custom-server'

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional(),
  unit: z.enum(VALID_UNITS as [string, ...string[]]).default('number'),
  category: z.enum(VALID_CATEGORIES as unknown as [string, ...string[]]).default('custom'),
  aggregation: z.enum(VALID_AGGREGATIONS as [string, ...string[]]).default('SUM'),
  higherIsBetter: z.boolean().default(true),
  target: z.number().finite().nullable().optional(),
  /** Optional backfill so a new metric has a trend line immediately. */
  values: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
        value: z.number().finite(),
        note: z.string().trim().max(200).optional(),
      })
    )
    .max(365)
    .optional(),
})

export async function GET() {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const metrics = await prisma.customMetric.findMany({
    orderBy: { label: 'asc' },
    include: { _count: { select: { values: true } } },
  })

  return NextResponse.json(
    metrics.map((m) => ({ ...m, metricId: customMetricId(m.key) }))
  )
}

export async function POST(req: Request) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  let body
  try {
    body = createSchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : 'Invalid request body'
    return NextResponse.json({ error: message ?? 'Invalid request body' }, { status: 400 })
  }

  // The key ends up in the metric id stored on every view item, so it has to be
  // unique and stable. Collisions are resolved rather than surfaced as a
  // constraint error the user can do nothing about.
  const base = slugifyMetricKey(body.label)
  let key = base
  for (let i = 2; await prisma.customMetric.findUnique({ where: { key } }); i++) {
    key = `${base}-${i}`
  }

  const metric = await prisma.customMetric.create({
    data: {
      key,
      label: body.label,
      description: body.description ?? '',
      unit: body.unit,
      category: body.category,
      aggregation: body.aggregation as 'SUM' | 'AVERAGE' | 'LATEST' | 'MAX' | 'MIN',
      higherIsBetter: body.higherIsBetter,
      createdById: auth.session.user.id,
      values: body.values?.length
        ? {
            create: body.values.map((v) => ({
              date: new Date(`${v.date}T00:00:00.000Z`),
              value: v.value,
              note: v.note ?? null,
              source: 'MANUAL' as const,
            })),
          }
        : undefined,
    },
    include: { _count: { select: { values: true } } },
  })

  if (body.target !== null && body.target !== undefined) {
    await prisma.metricTarget.upsert({
      where: { metricId: customMetricId(key) },
      create: { metricId: customMetricId(key), value: body.target, period: 'month' },
      update: { value: body.target },
    })
  }

  invalidateCustomMetricCache()

  return NextResponse.json({ ...metric, metricId: customMetricId(key) }, { status: 201 })
}
