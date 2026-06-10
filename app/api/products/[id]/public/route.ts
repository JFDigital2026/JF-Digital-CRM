import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public — no auth required (payment page)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const product = await prisma.product.findFirst({
    where: { id: params.id, active: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      price: true,
      interval: true,
      trialDays: true,
      planCount: true,
      planAmount: true,
      paymentFrequency: true,
      stripePriceId: true,
    },
  })

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}
