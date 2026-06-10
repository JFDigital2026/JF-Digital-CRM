import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'

interface TemplateTaskDef {
  title: string
  description?: string
  relativeDueDays?: number
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { templateId, contactId, companyId, startDate } = body

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const base = startDate ? new Date(startDate) : new Date()
  const taskDefs = (template.tasks as unknown as TemplateTaskDef[]) ?? []

  const created = await Promise.all(
    taskDefs.map((def) =>
      prisma.task.create({
        data: {
          title: def.title,
          description: def.description ?? null,
          dueDate: def.relativeDueDays != null ? addDays(base, def.relativeDueDays) : null,
          priority: def.priority ?? 'MEDIUM',
          status: 'TODO',
          contactId: contactId ?? null,
          companyId: companyId ?? null,
          assignedTo: session.user.id,
          templateId,
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      })
    )
  )

  return NextResponse.json({ tasks: created }, { status: 201 })
}
