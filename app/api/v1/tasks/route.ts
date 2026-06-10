import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err, paginate, parsePageParams } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'tasks:read')
  if (!auth.ok) return auth.response

  const { page, perPage, skip } = parsePageParams(req)
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? ''
  const contactId = url.searchParams.get('contactId') ?? ''

  const where = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(status && { status: status as any }),
    ...(contactId && { contactId }),
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { dueDate: 'asc' },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.task.count({ where }),
  ])

  return paginate(tasks, page, perPage, total)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'tasks:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { title, description, contactId, dueDate, priority, status } = body

  if (!title) return err('VALIDATION_ERROR', 'title is required')

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      contactId: contactId ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority ?? 'MEDIUM',
      status: status ?? 'TODO',
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })

  return ok(task, undefined, 201)
}
