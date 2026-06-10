import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } })
  if (!key || key.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.apiKey.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } })
  if (!key || key.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { active } = await req.json()
  const updated = await prisma.apiKey.update({
    where: { id: params.id },
    data: { ...(active !== undefined && { active }) },
  })

  return NextResponse.json({ key: updated })
}
