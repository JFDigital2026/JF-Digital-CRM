import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { customMetricId } from '@/lib/metrics/custom'

/**
 * Push values into a user-created metric from outside the CRM — an n8n workflow,
 * the Lead Gen dashboard, a script.
 *
 * Addressed by the metric's stable key rather than its row id, so a workflow can
 * be pointed at "linkedin-requests-sent" without anyone copying a cuid around.
 * Upserts per date, so re-sending an overlapping range corrects rather than
 * double-counts.
 *
 *   POST /api/v1/custom-metrics/linkedin-requests-sent/values
 *   Authorization: Bearer <key with metrics:write>
 *   { "values": [{ "date": "2026-07-26", "value": 34 }] }
 */

const bodySchema = z.object({
  values: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
        value: z.number().finite(),
        note: z.string().trim().max(200).optional(),
      })
    )
    .min(1)
    .max(400),
})

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const auth = await requireAuth(req, 'metrics:write')
  if (!auth.ok) return auth.response

  const metric = await prisma.customMetric.findUnique({ where: { key: params.key } })
  if (!metric) {
    // List the available keys — the usual cause is a typo in a workflow, and
    // guessing from a bare 404 is miserable.
    const all = await prisma.customMetric.findMany({ select: { key: true, label: true } })
    return err(
      'UNKNOWN_METRIC',
      `No custom metric with key "${params.key}". Available: ${
        all.length ? all.map((m) => m.key).join(', ') : 'none created yet'
      }`,
      404
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return err('INVALID_JSON', 'Request body must be valid JSON', 400)
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid payload', 400)
  }

  const written = await prisma.$transaction(
    parsed.data.values.map((v) => {
      const date = new Date(`${v.date}T00:00:00.000Z`)
      return prisma.customMetricValue.upsert({
        where: { customMetricId_date: { customMetricId: metric.id, date } },
        create: {
          customMetricId: metric.id,
          date,
          value: v.value,
          note: v.note ?? null,
          source: 'API',
        },
        update: { value: v.value, note: v.note ?? null, source: 'API' },
      })
    })
  )

  return ok(
    {
      metricId: customMetricId(metric.key),
      key: metric.key,
      label: metric.label,
      valuesWritten: written.length,
    },
    { idempotent: true }
  )
}

/** Read back what the CRM holds, so a workflow can reconcile before pushing. */
export async function GET(req: Request, { params }: { params: { key: string } }) {
  const auth = await requireAuth(req, 'metrics:read')
  if (!auth.ok) return auth.response

  const metric = await prisma.customMetric.findUnique({ where: { key: params.key } })
  if (!metric) return err('UNKNOWN_METRIC', `No custom metric with key "${params.key}"`, 404)

  const url = new URL(req.url)
  const limit = Math.min(365, Math.max(1, parseInt(url.searchParams.get('limit') ?? '60', 10)))

  const values = await prisma.customMetricValue.findMany({
    where: { customMetricId: metric.id },
    orderBy: { date: 'desc' },
    take: limit,
    select: { date: true, value: true, note: true, source: true },
  })

  return ok(
    { key: metric.key, label: metric.label, aggregation: metric.aggregation, values },
    { count: values.length }
  )
}
