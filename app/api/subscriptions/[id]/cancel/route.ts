import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { requirePermission } from '@/lib/permissions'

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('billing', 'manage')
  if (!auth.ok) return auth.response
  const session = auth.session

  const sub = await prisma.subscription.findFirst({
    where: { id: params.id, product: { userId: session.user.id } },
  })
  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (sub.stripeSubId && process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('REPLACE_ME')) {
    try {
      await stripe.subscriptions.cancel(sub.stripeSubId)
    } catch (err) {
      console.error('Stripe cancel failed:', err)
    }
  }

  const updated = await prisma.subscription.update({
    where: { id: params.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })

  return NextResponse.json(updated)
}
