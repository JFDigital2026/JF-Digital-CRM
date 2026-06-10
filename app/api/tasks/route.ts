import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'
  const search = searchParams.get('search') ?? ''
  const priorities = searchParams.getAll('priority[]')
  const contactId = searchParams.get('contactId')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'))

  const now = new Date()
  const where: Record<string, unknown> = {}

  if (filter === 'mine') {
    where.assignedTo = session.user.id
  } else if (filter === 'today') {
    where.dueDate = { gte: startOfDay(now), lte: endOfDay(now) }
  } else if (filter === 'overdue') {
    where.status = { not: 'COMPLETED' }
    where.dueDate = { lt: startOfDay(now) }
  } else if (filter === 'completed') {
    where.status = 'COMPLETED'
  }

  if (search) where.title = { contains: search, mode: 'insensitive' }
  if (priorities.length) where.priority = { in: priorities }
  if (contactId) where.contactId = contactId

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ])

  return NextResponse.json({ tasks, total })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      priority: body.priority ?? 'MEDIUM',
      status: body.status ?? 'TODO',
      contactId: body.contactId ?? null,
      companyId: body.companyId ?? null,
      assignedTo: body.assignedTo ?? session.user.id,
      isRecurring: body.isRecurring ?? false,
      recurrenceRule: body.recurrenceRule ?? null,
      followUpTaskId: body.followUpTaskId ?? null,
      templateId: body.templateId ?? null,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  })

  if (body.contactId) {
    await prisma.activityLog.create({
      data: {
        contactId: body.contactId,
        userId: session.user.id,
        type: 'task.created',
        description: `Task created: ${task.title}`,
      },
    })
  }

  if (task.dueDate) {
    const now = new Date()
    const isToday =
      task.dueDate >= startOfDay(now) && task.dueDate <= endOfDay(now)
    if (isToday) {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: 'TASK_DUE',
          title: 'Task due today',
          body: task.title,
          linkUrl: '/tasks',
        },
      })
    }
  }

  return NextResponse.json(task, { status: 201 })
}
