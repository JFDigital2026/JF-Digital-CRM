import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const values = await prisma.customValue.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(values)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, key, value } = await req.json()
  if (!name?.trim() || !key?.trim() || value === undefined)
    return NextResponse.json({ error: 'name, key, and value are required' }, { status: 400 })

  try {
    const cv = await prisma.customValue.create({
      data: { name: name.trim(), key: key.trim(), value, userId: session.user.id },
    })
    return NextResponse.json(cv, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Key already exists' }, { status: 409 })
  }
}
