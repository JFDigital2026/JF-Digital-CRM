// Simple sliding-window in-memory rate limiter.
// Works for single-instance deployments (Railway default).

const store = new Map<string, number[]>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now()
  const windowStart = now - windowMs
  const hits = (store.get(key) ?? []).filter((t) => t > windowStart)
  hits.push(now)
  store.set(key, hits)

  // Prune old keys every ~1000 calls to avoid unbounded growth
  if (store.size > 10000) {
    store.forEach((v, k) => {
      if (v.every((t: number) => t <= windowStart)) store.delete(k)
    })
  }

  return {
    success: hits.length <= limit,
    remaining: Math.max(0, limit - hits.length),
  }
}

export function getIp(req: Request): string {
  const forwarded = (req.headers as any).get?.('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
