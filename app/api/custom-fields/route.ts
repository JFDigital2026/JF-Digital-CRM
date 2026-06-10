import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fields = await prisma.customField.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(fields)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const field = await prisma.customField.create({
    data: {
      name: body.name,
      key: body.key,
      type: body.type,
      options: body.options || [],
    },
  })
  return NextResponse.json(field, { status: 201 })
}
