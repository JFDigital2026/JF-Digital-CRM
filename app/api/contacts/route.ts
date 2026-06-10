import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { triggerAutomation } from '@/lib/automation-engine'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const leadStatuses = searchParams.getAll('leadStatus')
  const dnc = searchParams.get('doNotContact')
  const tags = searchParams.getAll('tags')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const companyId = searchParams.get('companyId')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'))

  const includeUnverified = searchParams.get('includeUnverified') === 'true'

  const where: any = {
    AND: [
      // Always exclude __unverified__ contacts from the main contacts list
      includeUnverified ? {} : { NOT: { tags: { has: '__unverified__' } } },
      search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {},
      leadStatuses.length ? { leadStatus: { in: leadStatuses } } : {},
      dnc === 'true' ? { doNotContact: true } : {},
      tags.length ? { tags: { hasSome: tags } } : {},
      dateFrom ? { createdAt: { gte: new Date(dateFrom) } } : {},
      dateTo ? { createdAt: { lte: new Date(dateTo) } } : {},
      companyId ? { companyId } : {},
    ],
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
  ])

  return NextResponse.json({ contacts, total, page, pageSize })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customFields, newCompanyName, ...data } = body

  let companyId = data.companyId ?? null
  if (newCompanyName?.trim()) {
    const co = await prisma.company.create({ data: { name: newCompanyName.trim() } })
    companyId = co.id
  }

  const contact = await prisma.contact.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      title: data.title || null,
      role: data.role || null,
      source: data.source || null,
      tags: data.tags || [],
      doNotContact: data.doNotContact ?? false,
      notes: data.notes || null,
      leadStatus: data.leadStatus || 'NEW',
      companyId,
    },
    include: { company: { select: { id: true, name: true } } },
  })

  if (customFields && typeof customFields === 'object') {
    await Promise.all(
      Object.entries(customFields as Record<string, string>)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([customFieldId, value]) =>
          prisma.customFieldValue.upsert({
            where: { customFieldId_contactId: { customFieldId, contactId: contact.id } },
            create: { customFieldId, contactId: contact.id, value },
            update: { value },
          })
        )
    )
  }

  await prisma.activityLog.create({
    data: {
      contactId: contact.id,
      userId: session.user.id,
      type: 'contact.created',
      description: `Contact ${contact.firstName} ${contact.lastName} created`,
    },
  })

  // Auto-enroll contact in Lead stage of default pipeline
  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: { userId: session.user.id },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    })
    if (pipeline?.stages.length) {
      await prisma.opportunity.create({
        data: {
          title: `${contact.firstName} ${contact.lastName}`,
          contactId: contact.id,
          companyId: companyId ?? null,
          stageId: pipeline.stages[0].id,
          pipelineId: pipeline.id,
        },
      })
    }
  } catch {}

  // Fire automations — non-blocking
  triggerAutomation('CONTACT_CREATED', contact.id, {}).catch(() => {})

  return NextResponse.json(contact, { status: 201 })
}
