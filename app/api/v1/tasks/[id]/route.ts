import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { fireWebhook } from '@/lib/webhookDelivery'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'tasks:write')
  if (!auth.ok) return auth.response

  const task = await prisma.task.findUnique({ where: { id: params.id } })
  if (!task) return err('NOT_FOUND', 'Task not found', 404)

  const body = await req.json().catch(() => ({}))
  const { title, description, status, priority, dueDate, contactId } = body

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
      ...(contactId !== undefined && { contactId }),
    },
  })

  if (status === 'COMPLETED' && task.status !== 'COMPLETED') {
    fireWebhook(auth.userId, 'task.completed', { taskId: params.id, title: updated.title })
  }

  return ok(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'tasks:write')
  if (!auth.ok) return auth.response

  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!task) return err('NOT_FOUND', 'Task not found', 404)

  await prisma.task.delete({ where: { id: params.id } })
  return ok({ deleted: true })
}
