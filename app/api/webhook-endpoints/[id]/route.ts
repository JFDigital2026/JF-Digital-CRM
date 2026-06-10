import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: params.id } })
  if (!endpoint || endpoint.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.webhookEndpoint.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: params.id } })
  if (!endpoint || endpoint.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { url, events, active } = await req.json()
  const updated = await prisma.webhookEndpoint.update({
    where: { id: params.id },
    data: {
      ...(url !== undefined && { url }),
      ...(events !== undefined && { events }),
      ...(active !== undefined && { active }),
    },
  })

  return NextResponse.json({ endpoint: updated })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: params.id },
    include: {
      logs: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })

  if (!endpoint || endpoint.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ endpoint })
}
