import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { contactId, channel } = body as { contactId: string; channel: string }

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const messages = await prisma.message.findMany({
      where: { contactId, ...(channel && channel !== 'ALL' ? { channel: channel as any } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { contact: { select: { firstName: true, lastName: true } } },
    })

    if (!messages.length) {
      return NextResponse.json({ suggestion: '' })
    }

    const contact = messages[0].contact
    const contactName = contact ? `${contact.firstName} ${contact.lastName}` : 'Contact'

    const context = messages
      .reverse()
      .map((m) => `${m.direction === 'INBOUND' ? contactName : 'You'}: ${m.body}`)
      .join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are a helpful sales assistant. Based on this conversation, write a brief, professional reply. Return ONLY the reply text, nothing else.\n\nConversation:\n${context}\n\nYour reply:`,
        },
      ],
    })

    const suggestion =
      response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('AI reply error:', err)
    return NextResponse.json({ suggestion: '' })
  }
}
