import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
