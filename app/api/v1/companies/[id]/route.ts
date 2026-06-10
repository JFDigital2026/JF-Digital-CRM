import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'companies:read')
  if (!auth.ok) return auth.response

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      contacts: { select: { id: true, firstName: true, lastName: true, email: true, leadStatus: true }, take: 20 },
      _count: { select: { contacts: true } },
    },
  })

  if (!company) return err('NOT_FOUND', 'Company not found', 404)
  return ok(company)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'companies:write')
  if (!auth.ok) return auth.response

  const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!company) return err('NOT_FOUND', 'Company not found', 404)

  const body = await req.json().catch(() => ({}))
  const { name, website, industry, companySize, location, notes } = body

  const updated = await prisma.company.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(website !== undefined && { website }),
      ...(industry !== undefined && { industry }),
      ...(companySize !== undefined && { companySize }),
      ...(location !== undefined && { location }),
      ...(notes !== undefined && { notes }),
    },
  })

  return ok(updated)
}
