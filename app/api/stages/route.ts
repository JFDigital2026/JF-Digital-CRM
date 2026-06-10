import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pipelineId = searchParams.get('pipelineId')

  if (!pipelineId) return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 })

  const stages = await prisma.stage.findMany({
    where: { pipelineId },
    select: { id: true, name: true, color: true, order: true, pipelineId: true },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(stages)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { pipelineId, name, color, order } = body

  if (!pipelineId || !name) {
    return NextResponse.json({ error: 'pipelineId and name are required' }, { status: 400 })
  }

  const stage = await prisma.stage.create({
    data: {
      pipelineId,
      name,
      color: color ?? null,
      order: order ?? 0,
    },
    select: { id: true, name: true, color: true, order: true, pipelineId: true },
  })

  await prisma.activityLog.create({
    data: {
      type: 'pipeline.stage_added',
      description: `Stage "${name}" added`,
      userId: session.user.id,
    },
  })

  return NextResponse.json(stage, { status: 201 })
}
