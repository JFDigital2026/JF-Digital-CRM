import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const PAYMENT_FAILURE_TYPES = ['PAYMENT_FAILED', 'PAYMENT_DECLINED']

  const sorted = [
    ...notifications.filter((n) => PAYMENT_FAILURE_TYPES.includes(n.type)),
    ...notifications.filter((n) => !PAYMENT_FAILURE_TYPES.includes(n.type) && !n.read),
    ...notifications.filter((n) => !PAYMENT_FAILURE_TYPES.includes(n.type) && n.read),
  ]

  return NextResponse.json(sorted)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const notification = await prisma.notification.create({
    data: {
      userId: body.userId ?? session.user.id,
      type: body.type,
      title: body.title,
      body: body.body,
      linkUrl: body.linkUrl ?? null,
    },
  })

  return NextResponse.json(notification, { status: 201 })
}
