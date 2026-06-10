import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays, addMonths, addWeeks } from 'date-fns'
import { triggerAutomation } from '@/lib/automation-engine'

const taskInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: taskInclude,
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Fetch current task first so we can check for status transition and recurrence
  const current = await prisma.task.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description
  if (body.status !== undefined) updateData.status = body.status
  if (body.priority !== undefined) updateData.priority = body.priority
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.contactId !== undefined) updateData.contactId = body.contactId ?? null
  if (body.companyId !== undefined) updateData.companyId = body.companyId ?? null
  if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo ?? null
  if (body.isRecurring !== undefined) updateData.isRecurring = body.isRecurring
  if (body.recurrenceRule !== undefined) updateData.recurrenceRule = body.recurrenceRule ?? null
  if (body.followUpTaskId !== undefined) updateData.followUpTaskId = body.followUpTaskId ?? null
  if (body.templateId !== undefined) updateData.templateId = body.templateId ?? null

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
    include: taskInclude,
  })

  const completingNow = body.status === 'COMPLETED' && current.status !== 'COMPLETED'

  if (completingNow) {
    // Log completion
    await prisma.activityLog.create({
      data: {
        contactId: task.contactId ?? undefined,
        userId: session.user.id,
        type: 'task.completed',
        description: `Task completed: ${task.title}`,
      },
    })

    if (task.contactId) {
      triggerAutomation('TASK_COMPLETED', task.contactId, { taskTitle: task.title }).catch(() => {})
    }

    // Create next recurrence if applicable
    if (task.isRecurring && task.recurrenceRule && task.dueDate) {
      let nextDueDate: Date
      if (task.recurrenceRule === 'DAILY') {
        nextDueDate = addDays(task.dueDate, 1)
      } else if (task.recurrenceRule === 'WEEKLY') {
        nextDueDate = addWeeks(task.dueDate, 1)
      } else {
        // MONTHLY
        nextDueDate = addMonths(task.dueDate, 1)
      }

      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description ?? null,
          dueDate: nextDueDate,
          priority: task.priority,
          status: 'TODO',
          contactId: task.contactId ?? null,
          companyId: task.companyId ?? null,
          assignedTo: task.assignedTo ?? null,
          isRecurring: true,
          recurrenceRule: task.recurrenceRule,
          templateId: task.templateId ?? null,
        },
      })
    }
  }

  return NextResponse.json(task)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
