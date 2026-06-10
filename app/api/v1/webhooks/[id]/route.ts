import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: params.id },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 20 } },
  })

  if (!endpoint) return err('NOT_FOUND', 'Webhook endpoint not found', 404)
  if (endpoint.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)
  return ok(endpoint)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: params.id } })
  if (!endpoint) return err('NOT_FOUND', 'Webhook endpoint not found', 404)
  if (endpoint.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)

  const body = await req.json().catch(() => ({}))
  const { url, events, active } = body

  const updated = await prisma.webhookEndpoint.update({
    where: { id: params.id },
    data: {
      ...(url !== undefined && { url }),
      ...(events !== undefined && { events }),
      ...(active !== undefined && { active }),
    },
  })

  return ok(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: params.id } })
  if (!endpoint) return err('NOT_FOUND', 'Webhook endpoint not found', 404)
  if (endpoint.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)

  await prisma.webhookEndpoint.delete({ where: { id: params.id } })
  return ok({ deleted: true })
}
