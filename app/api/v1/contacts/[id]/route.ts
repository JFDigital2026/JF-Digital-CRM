import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { fireWebhook } from '@/lib/webhookDelivery'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      opportunities: { include: { stage: { select: { name: true } } }, take: 10 },
      tasks: { where: { status: { not: 'COMPLETED' } }, take: 10, orderBy: { dueDate: 'asc' } },
    },
  })

  if (!contact) return err('NOT_FOUND', 'Contact not found', 404)
  return ok(contact)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:write')
  if (!auth.ok) return auth.response

  const contact = await prisma.contact.findUnique({ where: { id: params.id } })
  if (!contact) return err('NOT_FOUND', 'Contact not found', 404)

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, email, phone, companyId, leadStatus, notes } = body

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(companyId !== undefined && { companyId }),
      ...(leadStatus !== undefined && { leadStatus }),
      ...(notes !== undefined && { notes }),
    },
    include: { company: { select: { id: true, name: true } } },
  })

  fireWebhook(auth.userId, 'contact.updated', { contactId: params.id, changes: body })

  return ok(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:write')
  if (!auth.ok) return auth.response

  const contact = await prisma.contact.findUnique({ where: { id: params.id } })
  if (!contact) return err('NOT_FOUND', 'Contact not found', 404)

  await prisma.contact.delete({ where: { id: params.id } })
  return ok({ deleted: true })
}
