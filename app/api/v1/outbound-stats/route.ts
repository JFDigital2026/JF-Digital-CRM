import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'

/**
 * Ingest for daily cold-email rollups pushed by the Lead Gen dashboard.
 *
 * Direction is push (Lead Gen → CRM) rather than pull, matching the existing
 * lead export in that project's server/integrations/crm.js. That keeps working
 * while the dashboard runs local-only; a pull would make a public deploy of it a
 * hard dependency.
 *
 * AGGREGATE COUNTS ONLY. The upstream getEmailStats() also returns
 * optedOutEmails[] and repliedLeads[] — real prospect addresses and reply
 * snippets. Those are rejected outright rather than silently dropped, so the
 * contract fails loudly if the payload is ever widened. Prospect contact data
 * stays in the Lead Gen datastore; copying it here would add no analytical value
 * and a second place to leak from.
 */

const daySchema = z.object({
  // Date-only (YYYY-MM-DD). Parsed as UTC midnight so the unique constraint
  // lines up regardless of the sender's timezone.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  sent: z.number().int().min(0).max(100_000).default(0),
  uniqueOpens: z.number().int().min(0).max(100_000).default(0),
  totalOpens: z.number().int().min(0).max(1_000_000).default(0),
  suppressedOpens: z.number().int().min(0).max(1_000_000).default(0),
  replied: z.number().int().min(0).max(100_000).default(0),
  positiveReplies: z.number().int().min(0).max(100_000).default(0),
  optedOut: z.number().int().min(0).max(100_000).default(0),
  bounced: z.number().int().min(0).max(100_000).default(0),
  linkedinSent: z.number().int().min(0).max(100_000).default(0),
  byInbox: z
    .array(
      z.object({
        label: z.string().max(120).optional(),
        email: z.string().max(200).optional(),
        sent: z.number().int().min(0).nullable().optional(),
        replied: z.number().int().min(0).nullable().optional(),
      })
    )
    .max(20)
    .optional(),
})
  // Positive replies are a subset of replies. Without this, a sender bug could
  // push a Positive Response Rate higher than the Response Rate it comes out
  // of — a contradiction that is far easier to reject here than to notice on a
  // dashboard weeks later.
  .refine((d) => d.positiveReplies <= d.replied, {
    message: 'positiveReplies cannot exceed replied',
  })

const bodySchema = z.object({
  days: z.array(daySchema).min(1).max(400),
  /**
   * The rolling IMAP window total, stored for reconciliation only. It must never
   * be used as a daily value — gmailStats reports a 30-day figure, and
   * attributing that to one date is the single most likely way these numbers go
   * quietly wrong. Per-day sends come from the pixel table's sent_at.
   */
  windowSent: z.number().int().min(0).nullish(),
  windowDays: z.number().int().min(1).max(365).nullish(),
})

/** Payload keys that would carry prospect PII. Presence is a hard rejection. */
const FORBIDDEN_KEYS = ['optedOutEmails', 'repliedLeads', 'emails', 'contacts', 'leads']

function findForbidden(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  for (const key of Object.keys(payload as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key)) return key
  }
  const days = (payload as { days?: unknown[] }).days
  if (Array.isArray(days)) {
    for (const day of days) {
      if (day && typeof day === 'object') {
        for (const key of Object.keys(day as Record<string, unknown>)) {
          if (FORBIDDEN_KEYS.includes(key)) return key
        }
      }
    }
  }
  return null
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'metrics:write')
  if (!auth.ok) return auth.response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return err('INVALID_JSON', 'Request body must be valid JSON', 400)
  }

  const forbidden = findForbidden(raw)
  if (forbidden) {
    return err(
      'PII_REJECTED',
      `Field "${forbidden}" carries prospect data. This endpoint accepts aggregate counts only — strip it before sending.`,
      422
    )
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid payload', 400)
  }

  const { days, windowSent, windowDays } = parsed.data
  const syncedAt = new Date()

  // Upsert on the unique date column. The upstream scan uses a rolling window
  // and resends overlapping days constantly, so repeated submission of the same
  // day must be idempotent rather than additive.
  const results = await prisma.$transaction(
    days.map((day) => {
      const date = new Date(`${day.date}T00:00:00.000Z`)
      const values = {
        sent: day.sent,
        uniqueOpens: day.uniqueOpens,
        totalOpens: day.totalOpens,
        suppressedOpens: day.suppressedOpens,
        replied: day.replied,
        positiveReplies: day.positiveReplies,
        optedOut: day.optedOut,
        bounced: day.bounced,
        linkedinSent: day.linkedinSent,
        byInbox: day.byInbox ?? undefined,
        windowSent: windowSent ?? null,
        windowDays: windowDays ?? null,
        syncedAt,
      }
      return prisma.outboundDailyStat.upsert({
        where: { date },
        create: { date, ...values },
        update: values,
      })
    })
  )

  return ok(
    {
      daysWritten: results.length,
      from: days[0]?.date,
      to: days[days.length - 1]?.date,
      syncedAt: syncedAt.toISOString(),
    },
    { idempotent: true }
  )
}

/** Lets the sender confirm what the CRM already holds before pushing. */
export async function GET(req: Request) {
  const auth = await requireAuth(req, 'metrics:read')
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const limit = Math.min(90, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10)))

  const rows = await prisma.outboundDailyStat.findMany({
    orderBy: { date: 'desc' },
    take: limit,
  })

  return ok(rows, { count: rows.length })
}
