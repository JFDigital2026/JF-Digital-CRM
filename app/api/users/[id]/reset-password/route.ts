import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requester = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (requester?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tempPassword = crypto.randomBytes(6).toString('base64').slice(0, 8)
  const hash = await bcrypt.hash(tempPassword, 12)

  await prisma.user.update({ where: { id: params.id }, data: { password: hash } })

  return NextResponse.json({ tempPassword })
}
