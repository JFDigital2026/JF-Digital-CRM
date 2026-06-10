import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MessageChannel } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel') as MessageChannel | null
  const search = searchParams.get('search')

  const where: any = {}
  if (channel) where.channel = channel

  const latestMessages = await prisma.message.findMany({
    where,
    distinct: ['contactId'],
    orderBy: { createdAt: 'desc' },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          leadStatus: true,
          avatarUrl: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  })

  let filtered = latestMessages
  if (search) {
    const q = search.toLowerCase()
    filtered = latestMessages.filter((m) =>
      `${m.contact.firstName} ${m.contact.lastName}`.toLowerCase().includes(q)
    )
  }

  const contactIds = filtered.map((m) => m.contactId)

  const [unreadGroups, channelGroups] = await Promise.all([
    prisma.message.groupBy({
      by: ['contactId'],
      _count: { id: true },
      where: { contactId: { in: contactIds }, read: false, direction: 'INBOUND' },
    }),
    prisma.message.findMany({
      where: { contactId: { in: contactIds } },
      select: { contactId: true, channel: true },
      distinct: ['contactId', 'channel'],
    }),
  ])

  const unreadMap = new Map(unreadGroups.map((u) => [u.contactId, u._count.id]))

  const channelMap = new Map<string, string[]>()
  channelGroups.forEach(({ contactId, channel: ch }) => {
    const arr = channelMap.get(contactId) ?? []
    arr.push(ch)
    channelMap.set(contactId, arr)
  })

  const conversations = filtered.map((m) => ({
    contact: m.contact,
    latestMessage: {
      id: m.id,
      body: m.body,
      channel: m.channel,
      direction: m.direction,
      subject: m.subject,
      createdAt: m.createdAt,
    },
    unreadCount: unreadMap.get(m.contactId) ?? 0,
    channels: channelMap.get(m.contactId) ?? [m.channel],
  }))

  return NextResponse.json({ conversations })
}
