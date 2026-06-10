import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MessageChannel } from '@prisma/client'

export async function GET(
  req: Request,
  { params }: { params: { contactId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel') as MessageChannel | null

  const where: any = { contactId: params.contactId }
  if (channel && channel !== ('ALL' as any)) where.channel = channel

  const [messages, contact] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.contact.findUnique({
      where: { id: params.contactId },
      include: { company: { select: { id: true, name: true } } },
    }),
  ])

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ messages, contact })
}
