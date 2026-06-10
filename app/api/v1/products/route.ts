import { requireAuth } from '@/lib/api-v1/auth'
import { paginate, parsePageParams } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'products:read')
  if (!auth.ok) return auth.response

  const { page, perPage, skip } = parsePageParams(req)
  const url = new URL(req.url)
  const active = url.searchParams.get('active')

  const where = {
    userId: auth.userId,
    ...(active === 'true' && { active: true }),
    ...(active === 'false' && { active: false }),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ])

  return paginate(products, page, perPage, total)
}
