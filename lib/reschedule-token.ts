import { createHmac } from 'crypto'

interface TokenPayload {
  eventId: string
  calSlug: string
  exp: number
}

export function createRescheduleToken(eventId: string, calSlug: string): string {
  const payload = Buffer.from(
    JSON.stringify({ eventId, calSlug, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })
  ).toString('base64url')
  const sig = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyRescheduleToken(token: string): TokenPayload {
  const dot = token.lastIndexOf('.')
  if (dot === -1) throw new Error('Invalid token')
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(payload).digest('base64url')
  if (sig !== expected) throw new Error('Invalid token')
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenPayload
  if (Date.now() > data.exp) throw new Error('Token expired')
  return data
}
