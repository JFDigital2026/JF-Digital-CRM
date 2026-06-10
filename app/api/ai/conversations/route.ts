import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversations = await prisma.aIConversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 1 },
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({ conversations })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, firstMessage } = await req.json() as { title?: string; firstMessage?: string }

  const conversation = await prisma.aIConversation.create({
    data: {
      userId: session.user.id,
      title: title ?? (firstMessage ? firstMessage.slice(0, 60) : 'New Conversation'),
    },
  })

  // Save first user message if provided
  if (firstMessage) {
    await prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: firstMessage },
    })
  }

  return NextResponse.json(conversation)
}
