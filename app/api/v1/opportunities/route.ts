import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err, paginate, parsePageParams } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'opportunities:read')
  if (!auth.ok) return auth.response

  const { page, perPage, skip } = parsePageParams(req)
  const url = new URL(req.url)
  const pipelineId = url.searchParams.get('pipelineId') ?? ''
  const stageId = url.searchParams.get('stageId') ?? ''

  const where = {
    ...(pipelineId && { pipelineId }),
    ...(stageId && { stageId }),
    outcome: null,
  }

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        stage: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.opportunity.count({ where }),
  ])

  return paginate(opportunities, page, perPage, total)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'opportunities:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { title, value, stageId, pipelineId, contactId, expectedCloseDate, notes } = body

  if (!title) return err('VALIDATION_ERROR', 'title is required')
  if (!stageId) return err('VALIDATION_ERROR', 'stageId is required')
  if (!pipelineId) return err('VALIDATION_ERROR', 'pipelineId is required')

  const opportunity = await prisma.opportunity.create({
    data: {
      title,
      value: value ? parseFloat(value) : null,
      stageId,
      pipelineId,
      contactId: contactId ?? null,
      closeDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      notes: notes ?? null,
    },
    include: {
      stage: { select: { id: true, name: true } },
      pipeline: { select: { id: true, name: true } },
    },
  })

  return ok(opportunity, undefined, 201)
}
