import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.tasks !== undefined) updateData.tasks = body.tasks

  const template = await prisma.taskTemplate.update({
    where: { id: params.id },
    data: updateData,
    include: {
      _count: { select: { linkedTasks: true } },
    },
  })

  return NextResponse.json(template)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.taskTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
