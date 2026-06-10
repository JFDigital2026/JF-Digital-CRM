import { requireAuth } from '@/lib/api-v1/auth'
import { ok } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'opportunities:read')
  if (!auth.ok) return auth.response

  const pipelines = await prisma.pipeline.findMany({
    where: { userId: auth.userId },
    include: {
      stages: { orderBy: { order: 'asc' }, select: { id: true, name: true, order: true } },
      _count: { select: { opportunities: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return ok(pipelines)
}
