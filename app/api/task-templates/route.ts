import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.taskTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { linkedTasks: true } },
    },
  })

  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, tasks } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const template = await prisma.taskTemplate.create({
    data: {
      name: name.trim(),
      tasks: tasks ?? [],
    },
    include: {
      _count: { select: { linkedTasks: true } },
    },
  })

  return NextResponse.json(template, { status: 201 })
}
