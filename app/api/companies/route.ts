import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import { toInt } from '@/lib/utils'

export async function GET(req: Request) {
  const auth = await requirePermission('companies', 'view')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const page = toInt(searchParams.get('page'), 1, { min: 1 })
  const pageSize = toInt(searchParams.get('pageSize'), 25, { min: 1, max: 100 })
  const typeahead = searchParams.get('typeahead') === 'true'

  // Typeahead mode: return minimal data for autocomplete
  if (typeahead || (!searchParams.get('page') && search)) {
    const companies = await prisma.company.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 10,
    })
    return NextResponse.json(companies)
  }

  // Build filter conditions
  const andConditions: object[] = []

  if (search) {
    andConditions.push({ name: { contains: search, mode: 'insensitive' as const } })
  }

  const industryParam = searchParams.get('industry')
  if (industryParam) {
    const industries = industryParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (industries.length > 0) {
      andConditions.push({
        OR: industries.map((ind) => ({ industry: { contains: ind, mode: 'insensitive' as const } })),
      })
    }
  }

  const companySizeParam = searchParams.get('companySize')
  if (companySizeParam) {
    const sizes = companySizeParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (sizes.length > 0) {
      andConditions.push({ companySize: { in: sizes } })
    }
  }

  const locationParam = searchParams.get('location')
  if (locationParam) {
    andConditions.push({ location: { contains: locationParam, mode: 'insensitive' as const } })
  }

  const lastProjectDateFrom = searchParams.get('lastProjectDateFrom')
  if (lastProjectDateFrom) {
    const fromDate = new Date(lastProjectDateFrom)
    if (!isNaN(fromDate.getTime())) {
      andConditions.push({ lastProjectDate: { gte: fromDate } })
    }
  }

  const lastProjectDateTo = searchParams.get('lastProjectDateTo')
  if (lastProjectDateTo) {
    const toDate = new Date(lastProjectDateTo)
    if (!isNaN(toDate.getTime())) {
      andConditions.push({ lastProjectDate: { lte: toDate } })
    }
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {}

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        website: true,
        industry: true,
        companySize: true,
        location: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        country: true,
        timezone: true,
        notes: true,
        lastProjectDate: true,
        lastProjectSummary: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.company.count({ where }),
  ])

  return NextResponse.json({ companies, total, page, pageSize })
}

export async function POST(req: Request) {
  const auth = await requirePermission('companies', 'create')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { name, website, industry, companySize, address, city, state, zip, country, timezone, notes } = body

  const company = await prisma.company.create({
    data: {
      name,
      ...(website && { website }),
      ...(industry && { industry }),
      ...(companySize && { companySize }),
      ...(address && { address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(zip && { zip }),
      ...(country && { country }),
      ...(timezone && { timezone }),
      ...(notes && { notes }),
    },
  })

  // Auto-enroll in first stage of default pipeline
  try {
    const pipeline = await prisma.pipeline.findFirst({
      where: {},
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    })
    if (pipeline && pipeline.stages.length > 0) {
      await prisma.opportunity.create({
        data: {
          title: name,
          companyId: company.id,
          stageId: pipeline.stages[0].id,
          pipelineId: pipeline.id,
        },
      })
    }
  } catch {}

  return NextResponse.json(company, { status: 201 })
}
