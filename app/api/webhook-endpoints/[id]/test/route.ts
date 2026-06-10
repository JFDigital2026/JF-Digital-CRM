import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createHmac } from 'crypto'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: params.id } })
  if (!endpoint || endpoint.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const testPayload = JSON.stringify({
    event: 'webhook.test',
    data: { message: 'Test delivery from your CRM.' },
    timestamp: Date.now(),
  })
  const sig = 'sha256=' + createHmac('sha256', endpoint.secret).update(testPayload).digest('hex')

  let statusCode: number | null = null
  let success = false
  let error: string | null = null

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': sig,
        'X-Event': 'webhook.test',
        'X-Timestamp': String(Date.now()),
      },
      body: testPayload,
      signal: AbortSignal.timeout(8000),
    })
    statusCode = res.status
    success = res.ok
  } catch (e) {
    error = String(e)
  }

  await prisma.webhookLog.create({
    data: {
      webhookEndpointId: params.id,
      event: 'webhook.test',
      payload: { message: 'test delivery' },
      statusCode,
      attempt: 1,
      success,
    },
  })

  return NextResponse.json({ success, statusCode, error })
}
