import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import { isKnownMetric } from '@/lib/metrics/registry'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  isShared: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  items: z
    .array(
      z.object({
        metricId: z.string().min(1),
        showTrend: z.boolean().optional().default(false),
      })
    )
    .max(60)
    .optional(),
})

/**
 * Ownership check. ADMIN may manage any view; everyone else only their own.
 * Hiding the edit button is not access control — this runs on every mutation.
 */
async function loadOwned(id: string, userId: string, role: string) {
  const view = await prisma.metricView.findUnique({ where: { id } })
  if (!view) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (view.ownerId !== userId && role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { view }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const view = await prisma.metricView.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { order: 'asc' } } },
  })
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = view.ownerId === auth.session.user.id
  if (!isOwner && !view.isShared && auth.session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(view)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const owned = await loadOwned(params.id, auth.session.user.id, auth.session.user.role)
  if (owned.error) return owned.error

  let body
  try {
    body = updateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Items are replaced wholesale rather than diffed — the editor always sends
  // the full ordered list, and a replace keeps order contiguous for free.
  if (body.items) {
    const known = body.items.filter((i) => isKnownMetric(i.metricId))
    await prisma.$transaction([
      prisma.metricViewItem.deleteMany({ where: { viewId: params.id } }),
      prisma.metricViewItem.createMany({
        data: known.map((item, index) => ({
          viewId: params.id,
          metricId: item.metricId,
          showTrend: item.showTrend ?? false,
          order: index,
        })),
      }),
    ])
  }

  const view = await prisma.metricView.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isShared !== undefined ? { isShared: body.isShared } : {}),
      ...(body.order !== undefined ? { order: body.order } : {}),
    },
    include: { items: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(view)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const owned = await loadOwned(params.id, auth.session.user.id, auth.session.user.role)
  if (owned.error) return owned.error

  await prisma.metricView.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
