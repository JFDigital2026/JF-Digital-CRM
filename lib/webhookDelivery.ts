import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'

function sign(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
}

async function deliver(
  endpointId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
  attempt: number
): Promise<void> {
  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })
  const sig = sign(body, secret)

  let statusCode: number | null = null
  let success = false

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': sig,
        'X-Event': event,
        'X-Timestamp': String(Date.now()),
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
    statusCode = res.status
    success = res.ok
  } catch {
    // network error
  }

  await prisma.webhookLog.create({
    data: {
      webhookEndpointId: endpointId,
      event,
      payload: payload as import('@prisma/client').Prisma.InputJsonValue,
      statusCode,
      attempt,
      success,
    },
  }).catch(() => {})

  if (!success && attempt < 3) {
    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
    return deliver(endpointId, url, secret, event, payload, attempt + 1)
  }
}

export async function fireWebhook(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId, active: true, events: { has: event } },
  })

  // Fire all in parallel, do not await (fire-and-forget)
  for (const ep of endpoints) {
    deliver(ep.id, ep.url, ep.secret, event, payload, 1).catch(() => {})
  }
}
