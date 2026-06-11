import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/pipelines/[id]
// Body: { name?: string, stages: Array<{ id?: string, name: string, color: string, order: number }> }
// Stages with id → update. Stages without id → create. Existing stages not in list → delete (opps moved to first remaining stage).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: params.id },
    include: { stages: true },
  })
  if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, stages } = await req.json()

  // Update pipeline name if provided
  if (name?.trim()) {
    await prisma.pipeline.update({ where: { id: params.id }, data: { name: name.trim() } })
  }

  const incomingIds = stages.filter((s: any) => s.id).map((s: any) => s.id)
  const existingIds = pipeline.stages.map((s) => s.id)
  const toDelete = existingIds.filter((id) => !incomingIds.includes(id))

  // Move opps from deleted stages to first surviving stage
  if (toDelete.length > 0) {
    const surviving = stages.find((s: any) => s.id && !toDelete.includes(s.id)) ?? stages[0]
    // surviving.id may not exist yet (new stage) — find first existing stage not being deleted
    const survivingId = pipeline.stages.find((s) => !toDelete.includes(s.id))?.id
    if (survivingId) {
      await prisma.opportunity.updateMany({
        where: { stageId: { in: toDelete }, pipelineId: params.id },
        data: { stageId: survivingId },
      })
    }
    await prisma.stage.deleteMany({ where: { id: { in: toDelete } } })
  }

  // Upsert stages
  await Promise.all(
    stages.map(async (s: { id?: string; name: string; color: string; order: number }) => {
      if (s.id) {
        await prisma.stage.update({
          where: { id: s.id },
          data: { name: s.name, color: s.color, order: s.order },
        })
      } else {
        await prisma.stage.create({
          data: { name: s.name, color: s.color, order: s.order, pipelineId: params.id },
        })
      }
    })
  )

  const updated = await prisma.pipeline.findUnique({
    where: { id: params.id },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.pipeline.deleteMany({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
