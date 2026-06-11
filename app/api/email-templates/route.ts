import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await prisma.emailTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, subject, body } = await req.json()
  if (!name?.trim() || !subject?.trim()) return NextResponse.json({ error: 'Name and subject required' }, { status: 400 })
  const template = await prisma.emailTemplate.create({
    data: { userId: session.user.id, name: name.trim(), subject: subject.trim(), body: body ?? '' },
  })
  return NextResponse.json(template, { status: 201 })
}
