import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requester = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (requester?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.role === 'ADMIN') return NextResponse.json({ error: 'Cannot deactivate ADMIN account' }, { status: 403 })

  const { active } = await req.json()
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { active: Boolean(active) },
    select: { id: true, active: true },
  })

  return NextResponse.json(user)
}
