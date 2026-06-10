import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
  })

  return ok(endpoints)
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, 'contacts:read')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { url, events } = body

  if (!url) return err('VALIDATION_ERROR', 'url is required')
  if (!Array.isArray(events) || events.length === 0) {
    return err('VALIDATION_ERROR', 'events array is required')
  }

  const secret = randomBytes(24).toString('hex')

  const endpoint = await prisma.webhookEndpoint.create({
    data: { userId: auth.userId, url, events, secret },
  })

  return ok({ ...endpoint, secret }, undefined, 201)
}
