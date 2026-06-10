import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')

  if (!contactId) {
    return NextResponse.json({ error: 'contactId required' }, { status: 400 })
  }

  const notes = await prisma.conversationNote.findMany({
    where: { contactId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ notes })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { contactId, body: noteBody } = body as { contactId: string; body: string }

  if (!contactId || !noteBody) {
    return NextResponse.json({ error: 'contactId and body are required' }, { status: 400 })
  }

  const note = await prisma.conversationNote.create({
    data: {
      contactId,
      body: noteBody,
      userId: session.user.id,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(note, { status: 201 })
}
