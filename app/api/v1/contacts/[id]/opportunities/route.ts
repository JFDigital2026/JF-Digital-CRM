import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'opportunities:read')
  if (!auth.ok) return auth.response

  const contact = await prisma.contact.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!contact) return err('NOT_FOUND', 'Contact not found', 404)

  const opportunities = await prisma.opportunity.findMany({
    where: { contactId: params.id },
    include: {
      stage: { select: { id: true, name: true } },
      pipeline: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(opportunities)
}
