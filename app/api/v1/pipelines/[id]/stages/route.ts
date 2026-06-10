import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'opportunities:read')
  if (!auth.ok) return auth.response

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  })

  if (!pipeline) return err('NOT_FOUND', 'Pipeline not found', 404)
  if (pipeline.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)

  const stages = await prisma.stage.findMany({
    where: { pipelineId: params.id },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { opportunities: true } },
    },
  })

  return ok(stages)
}
