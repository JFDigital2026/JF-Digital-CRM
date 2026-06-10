import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'messages:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { contactId, channel, subject, body: msgBody } = body

  if (!contactId) return err('VALIDATION_ERROR', 'contactId is required')
  if (!channel) return err('VALIDATION_ERROR', 'channel is required (EMAIL | SMS)')
  if (!msgBody) return err('VALIDATION_ERROR', 'body is required')

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { id: true } })
  if (!contact) return err('NOT_FOUND', 'Contact not found', 404)

  const message = await prisma.message.create({
    data: {
      contactId,
      direction: 'OUTBOUND',
      channel: channel.toUpperCase(),
      subject: subject ?? null,
      body: msgBody,
    },
  })

  return ok(message, undefined, 201)
}
