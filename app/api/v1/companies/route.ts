import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err, paginate, parsePageParams } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'companies:read')
  if (!auth.ok) return auth.response

  const { page, perPage, skip } = parsePageParams(req)
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''

  const where = search
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {}

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.company.count({ where }),
  ])

  return paginate(companies, page, perPage, total)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'companies:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { name, website, industry, companySize, location, notes } = body

  if (!name) return err('VALIDATION_ERROR', 'name is required')

  const company = await prisma.company.create({
    data: {
      name,
      website: website ?? null,
      industry: industry ?? null,
      companySize: companySize ?? null,
      location: location ?? null,
      notes: notes ?? null,
    },
  })

  return ok(company, undefined, 201)
}
