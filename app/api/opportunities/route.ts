import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)))

  const where: any = {}
  if (pipelineId) where.pipelineId = pipelineId
  if (stageId) where.stageId = stageId
  if (search) where.title = { contains: search, mode: 'insensitive' }
  if (assignedTo) where.assignedTo = assignedTo
  if (companyId) where.companyId = companyId

  if (closeDateFrom || closeDateTo) {
    where.closeDate = {}
    if (closeDateFrom) where.closeDate.gte = new Date(closeDateFrom)
    if (closeDateTo) where.closeDate.lte = new Date(closeDateTo)
  }

  if (valueMin !== null || valueMax !== null) {
    where.value = {}
    if (valueMin !== null) where.value.gte = parseFloat(valueMin)
    if (valueMax !== null) where.value.lte = parseFloat(valueMax)
  }

  if (probabilityMin !== null || probabilityMax !== null) {
    where.probability = {}
    if (probabilityMin !== null) where.probability.gte = parseFloat(probabilityMin)
    if (probabilityMax !== null) where.probability.lte = parseFloat(probabilityMax)
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
