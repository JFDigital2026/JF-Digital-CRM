import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err, paginate, parsePageParams } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'calendar:read')
  if (!auth.ok) return auth.response

  const { page, perPage, skip } = parsePageParams(req)
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const where = {
    userId: auth.userId,
    ...(from && { startTime: { gte: new Date(from) } }),
    ...(to && { endTime: { lte: new Date(to) } }),
  }

  const [events, total] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { startTime: 'asc' },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.calendarEvent.count({ where }),
  ])

  return paginate(events, page, perPage, total)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'calendar:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { title, startTime, endTime, contactId, notes, calendarConfigId } = body

  if (!title) return err('VALIDATION_ERROR', 'title is required')
  if (!startTime) return err('VALIDATION_ERROR', 'startTime is required')
  if (!endTime) return err('VALIDATION_ERROR', 'endTime is required')

  let configId = calendarConfigId
  if (!configId) {
    const config = await prisma.calendarConfig.findFirst({ where: { userId: auth.userId } })
    if (!config) return err('UNPROCESSABLE', 'No calendar configured for this account', 422)
    configId = config.id
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      contactId: contactId ?? null,
      notes: notes ?? null,
      userId: auth.userId,
      calendarConfigId: configId,
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })

  return ok(event, undefined, 201)
}
