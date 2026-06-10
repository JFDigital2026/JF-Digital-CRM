import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { fireWebhook } from '@/lib/webhookDelivery'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'calendar:read')
  if (!auth.ok) return auth.response

  const event = await prisma.calendarEvent.findUnique({
    where: { id: params.id },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })

  if (!event) return err('NOT_FOUND', 'Event not found', 404)
  if (event.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)
  return ok(event)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'calendar:write')
  if (!auth.ok) return auth.response

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } })
  if (!event) return err('NOT_FOUND', 'Event not found', 404)
  if (event.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)

  const body = await req.json().catch(() => ({}))
  const { title, startTime, endTime, status, notes, contactId } = body

  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(startTime !== undefined && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: new Date(endTime) }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      ...(contactId !== undefined && { contactId }),
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })

  if (status === 'NO_SHOW' && event.status !== 'NO_SHOW') {
    fireWebhook(auth.userId, 'appointment.no_show', {
      eventId: params.id,
      title: updated.title,
      contactId: updated.contactId,
    })
  }

  return ok(updated)
}
