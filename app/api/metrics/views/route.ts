import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'
import { isKnownMetricAsync } from '@/lib/metrics/registry'

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional(),
  metricIds: z.array(z.string().min(1)).max(60).optional(),
})

// Not exported: Next.js route modules may only export HTTP method handlers and
// a fixed set of route config keys. Anything else fails route type validation.
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'view'
  )
}

/** Visible views: the user's own plus anything explicitly shared. */
function visibilityFilter(userId: string) {
  return { OR: [{ ownerId: userId }, { isShared: true }] }
}

export async function GET() {
  // Rendering a view only needs metrics.view — composing one needs
  // settings.manageMetrics. Reading is the common case, so it stays open to
  // anyone who can see the metrics page at all.
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const views = await prisma.metricView.findMany({
    where: visibilityFilter(auth.session.user.id),
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: { items: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(views)
}

export async function POST(req: Request) {
  const auth = await requirePermission('settings', 'manageMetrics')
  if (!auth.ok) return auth.response

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = createSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Only ids that exist in the registry — code-defined or user-created — are
  // ever persisted. This is the guard that keeps a config row from being able to
  // describe a query.
  const requested = body.metricIds ?? []
  const known = await Promise.all(requested.map(isKnownMetricAsync))
  const metricIds = requested.filter((_, i) => known[i])

  // Slug is user-visible in the ?view= param, so collisions must be resolved
  // rather than surfaced as a unique-constraint error.
  const base = slugify(body.name)
  let slug = base
  for (let i = 2; await prisma.metricView.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`
  }

  const maxOrder = await prisma.metricView.aggregate({ _max: { order: true } })

  const view = await prisma.metricView.create({
    data: {
      name: body.name,
      description: body.description || null,
      slug,
      ownerId: session.user.id,
      order: (maxOrder._max.order ?? 0) + 1,
      items: {
        create: metricIds.map((metricId, index) => ({ metricId, order: index })),
      },
    },
    include: { items: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(view, { status: 201 })
}
