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
  const isActive = Boolean(active)
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { active: isActive },
    select: { id: true, active: true },
  })

  // Cutting off a deactivated user also disables their API keys so they show as
  // revoked in the UI (requireAuth already rejects them at request time).
  if (!isActive) {
    await prisma.apiKey.updateMany({
      where: { userId: params.id, active: true },
      data: { active: false },
    })
  }

  return NextResponse.json(user)
}
