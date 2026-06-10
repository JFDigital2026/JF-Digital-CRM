import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, color, order } = body

  const stage = await prisma.stage.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    },
    select: { id: true, name: true, color: true, order: true, pipelineId: true },
  })

  return NextResponse.json(stage)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the stage to be deleted
  const stageToDelete = await prisma.stage.findUnique({
    where: { id: params.id },
    select: { id: true, order: true, pipelineId: true },
  })

  if (!stageToDelete) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
  }

  // Find all other stages in the same pipeline, ordered by order asc
  const otherStages = await prisma.stage.findMany({
    where: { pipelineId: stageToDelete.pipelineId, id: { not: params.id } },
    orderBy: { order: 'asc' },
  })

  // Determine the target stage: next-order stage, then previous, then null
  let targetStageId: string | null = null
  if (otherStages.length > 0) {
    const nextStage = otherStages.find((s) => s.order > stageToDelete.order)
    const prevStage = [...otherStages].reverse().find((s) => s.order < stageToDelete.order)
    targetStageId = (nextStage ?? prevStage ?? otherStages[0]).id
  }

  // Move all opportunities in the deleted stage to the target stage
  if (targetStageId) {
    await prisma.opportunity.updateMany({
      where: { stageId: params.id },
      data: { stageId: targetStageId },
    })
  }

  await prisma.stage.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
