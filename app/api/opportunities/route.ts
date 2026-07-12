import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import { toInt, parseDateParam } from '@/lib/utils'

export async function GET(req: Request) {
  const auth = await requirePermission('pipelines', 'view')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const pipelineId = searchParams.get('pipelineId')
  const stageId = searchParams.get('stageId')
  const search = searchParams.get('search') ?? ''
  const assignedTo = searchParams.get('assignedTo')
  const closeDateFrom = searchParams.get('closeDateFrom')
  const closeDateTo = searchParams.get('closeDateTo')
  const valueMin = searchParams.get('valueMin')
  const valueMax = searchParams.get('valueMax')
  const probabilityMin = searchParams.get('probabilityMin')
  const probabilityMax = searchParams.get('probabilityMax')
  const companyId = searchParams.get('companyId')

  const page = toInt(searchParams.get('page'), 1, { min: 1 })
  const pageSize = toInt(searchParams.get('pageSize'), 50, { min: 1, max: 200 })

  const where: any = {}
  if (pipelineId) where.pipelineId = pipelineId
  if (stageId) where.stageId = stageId
  if (search) where.title = { contains: search, mode: 'insensitive' }
  if (assignedTo) where.assignedTo = assignedTo
  if (companyId) where.companyId = companyId

  // parseDateParam / Number.isFinite guards keep unparseable query values from
  // reaching Prisma as Invalid Date / NaN (both throw or silently match nothing).
  const closeFrom = parseDateParam(closeDateFrom)
  const closeTo = parseDateParam(closeDateTo)
  if (closeFrom || closeTo) {
    where.closeDate = {}
    if (closeFrom) where.closeDate.gte = closeFrom
    if (closeTo) where.closeDate.lte = closeTo
  }

  const valueMinN = valueMin !== null ? parseFloat(valueMin) : NaN
  const valueMaxN = valueMax !== null ? parseFloat(valueMax) : NaN
  if (Number.isFinite(valueMinN) || Number.isFinite(valueMaxN)) {
    where.value = {}
    if (Number.isFinite(valueMinN)) where.value.gte = valueMinN
    if (Number.isFinite(valueMaxN)) where.value.lte = valueMaxN
  }

  const probMinN = probabilityMin !== null ? parseFloat(probabilityMin) : NaN
  const probMaxN = probabilityMax !== null ? parseFloat(probabilityMax) : NaN
  if (Number.isFinite(probMinN) || Number.isFinite(probMaxN)) {
    where.probability = {}
    if (Number.isFinite(probMinN)) where.probability.gte = probMinN
    if (Number.isFinite(probMaxN)) where.probability.lte = probMaxN
  }

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true, address: true, city: true, state: true, website: true } },
        stage: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.opportunity.count({ where }),
  ])

  return NextResponse.json({ opportunities, total })
}

export async function POST(req: Request) {
  const auth = await requirePermission('pipelines', 'create')
  if (!auth.ok) return auth.response
  const session = auth.session

  const body = await req.json()
  const { title, value, probability, closeDate, contactId, companyId, stageId, pipelineId, notes } = body

  const opportunity = await prisma.opportunity.create({
    data: {
      title,
      value: value ? parseFloat(value) : null,
      probability: probability ? parseFloat(probability) : null,
      closeDate: closeDate ? new Date(closeDate) : null,
      contactId: contactId || null,
      companyId: companyId || null,
      stageId,
      pipelineId,
      notes,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, color: true } },
    },
  })

  await prisma.activityLog.create({
    data: {
      type: 'opportunity.created',
      description: `Deal "${title}" created`,
      contactId: contactId || null,
      companyId: companyId || null,
      userId: session.user.id,
    },
  })

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: 'FORM_SUBMITTED',
      title: 'New Deal Created',
      body: `"${opportunity.title}" added to pipeline`,
      linkUrl: `/opportunities/${opportunity.id}`,
    },
  })

  return NextResponse.json(opportunity, { status: 201 })
}
