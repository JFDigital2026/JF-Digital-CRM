import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err, paginate, parsePageParams } from '@/lib/api-v1/response'
import { fireWebhook } from '@/lib/webhookDelivery'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const { page, perPage, skip } = parsePageParams(req)
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const status = url.searchParams.get('status') ?? ''

  const where = {
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(status && { leadStatus: status as any }),
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.contact.count({ where }),
  ])

  return paginate(contacts, page, perPage, total)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'contacts:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, email, phone, companyId, leadStatus, notes } = body

  if (!firstName) return err('VALIDATION_ERROR', 'firstName is required')

  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName: lastName ?? '',
      email: email ?? null,
      phone: phone ?? null,
      companyId: companyId ?? null,
      leadStatus: leadStatus ?? 'NEW',
      notes: notes ?? null,
    },
    include: { company: { select: { id: true, name: true } } },
  })

  fireWebhook(auth.userId, 'contact.created', { contactId: contact.id, firstName, lastName, email })

  return ok(contact, undefined, 201)
}
