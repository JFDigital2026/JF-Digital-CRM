import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

export async function GET() {
  const auth = await requirePermission('pipelines', 'view')
  if (!auth.ok) return auth.response
  const session = auth.session

  const pipelines = await prisma.pipeline.findMany({
    where: {},
    include: {
      stages: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Create a default pipeline if none exist
  if (pipelines.length === 0) {
    const defaultPipeline = await prisma.pipeline.create({
      data: {
        name: 'Sales',
        userId: session.user.id,
        isDefault: true,
        stages: {
          create: [
            { name: 'Lead', order: 1, color: '#415A77' },
            { name: 'Responded', order: 2, color: '#778DA9' },
            { name: 'No Answer', order: 3, color: '#E76F51' },
            { name: 'Booked Appt', order: 4, color: '#E9C46A' },
            { name: 'Strategy Call', order: 5, color: '#F4A261' },
            { name: 'Closing Call', order: 6, color: '#2A9D8F' },
            { name: 'Follow Up', order: 7, color: '#6366F1' },
          ],
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json([defaultPipeline])
  }

  return NextResponse.json(pipelines)
}

export async function POST(req: Request) {
  const auth = await requirePermission('pipelines', 'managePipelines')
  if (!auth.ok) return auth.response
  const session = auth.session

  const { name, stages } = await req.json()

  const stageData: { name: string; order: number; color: string }[] =
    Array.isArray(stages) && stages.length > 0
      ? stages.map((s: { name: string; color?: string }, i: number) => ({
          name: s.name,
          order: i + 1,
          color: s.color ?? '#415A77',
        }))
      : [
          { name: 'Lead', order: 1, color: '#415A77' },
          { name: 'In Progress', order: 2, color: '#E9C46A' },
          { name: 'Qualified', order: 3, color: '#2A9D8F' },
          { name: 'Closed', order: 4, color: '#E76F51' },
        ]

  const pipeline = await prisma.pipeline.create({
    data: {
      name,
      userId: session.user.id,
      stages: { create: stageData },
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(pipeline, { status: 201 })
}
