import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const status = searchParams.get('status')

  const where: Record<string, unknown> = {
    product: { userId: session.user.id },
  }
  if (productId) where.productId = productId
  if (status) where.status = status

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, type: true, interval: true, price: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ subscriptions })
}
