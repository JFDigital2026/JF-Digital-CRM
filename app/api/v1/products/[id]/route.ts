import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'products:read')
  if (!auth.ok) return auth.response

  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) return err('NOT_FOUND', 'Product not found', 404)
  if (product.userId !== auth.userId) return err('FORBIDDEN', 'Access denied', 403)
  return ok(product)
}
