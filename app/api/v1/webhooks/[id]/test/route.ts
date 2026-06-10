import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: params.id } })
  if (!endpoint) return err('NOT_FOUND', 'Webhook endpoint not found', 404)
  if (endpoint.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)

  const testPayload = JSON.stringify({
    event: 'webhook.test',
    data: { message: 'This is a test delivery from your CRM.' },
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
      signal: AbortSignal.timeout(10000),
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

  return ok({ success, statusCode, error })
}
