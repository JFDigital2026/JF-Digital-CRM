import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export type AuthResult =
  | { ok: true; apiKeyId: string; userId: string }
  | { ok: false; response: NextResponse }

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

const RATE_LIMIT = 1000
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function requireAuth(
  req: Request,
  scope: string
): Promise<AuthResult> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } },
        { status: 401 }
      ),
    }
  }

  const rawKey = auth.slice(7)
  const hashedKey = hashApiKey(rawKey)

  const apiKey = await prisma.apiKey.findUnique({ where: { hashedKey } })

  if (!apiKey || !apiKey.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or inactive API key' } },
        { status: 401 }
      ),
    }
  }

  if (!apiKey.scopes.includes(scope) && !apiKey.scopes.includes('*')) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: `Scope required: ${scope}` } },
        { status: 403 }
      ),
    }
  }

  // Rate limiting
  const now = new Date()
  const windowAge = apiKey.windowStart
    ? now.getTime() - apiKey.windowStart.getTime()
    : Infinity

  if (apiKey.windowStart && windowAge < WINDOW_MS) {
    if (apiKey.requestCount >= RATE_LIMIT) {
      const retryAfter = Math.ceil((WINDOW_MS - windowAge) / 1000)
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Try again later.' } },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(RATE_LIMIT),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor((apiKey.windowStart.getTime() + WINDOW_MS) / 1000)),
              'Retry-After': String(retryAfter),
            },
          }
        ),
      }
    }
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { requestCount: { increment: 1 }, lastUsed: now },
    })
  } else {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { requestCount: 1, windowStart: now, lastUsed: now },
    })
  }

  // Log the request
  const url = new URL(req.url)
  await prisma.apiLog.create({
    data: {
      apiKeyId: apiKey.id,
      endpoint: url.pathname,
      method: req.method,
      statusCode: 200,
    },
  }).catch(() => {})

  return { ok: true, apiKeyId: apiKey.id, userId: apiKey.userId }
}
