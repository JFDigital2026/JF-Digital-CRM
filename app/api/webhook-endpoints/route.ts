import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    })

    return NextResponse.json({ endpoints })
  } catch (err) {
    console.error('[webhook-endpoints GET]', err)
    return NextResponse.json({ endpoints: [] })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, events } = await req.json()
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 })
    }

    const secret = randomBytes(24).toString('hex')

    const endpoint = await prisma.webhookEndpoint.create({
      data: { userId: session.user.id, url, events, secret },
    })

    return NextResponse.json({ endpoint: { ...endpoint, secret } }, { status: 201 })
  } catch (err) {
    console.error('[webhook-endpoints POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
