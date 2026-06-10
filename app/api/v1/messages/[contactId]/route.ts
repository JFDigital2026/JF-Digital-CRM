import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err, paginate, parsePageParams } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { contactId: string } }) {
  const auth = await requireAuth(req, 'messages:read')
  if (!auth.ok) return auth.response

  const contact = await prisma.contact.findUnique({ where: { id: params.contactId }, select: { id: true } })
  if (!contact) return err('NOT_FOUND', 'Contact not found', 404)

  const { page, perPage, skip } = parsePageParams(req)

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { contactId: params.contactId },
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.message.count({ where: { contactId: params.contactId } }),
  ])

  return paginate(messages, page, perPage, total)
}
