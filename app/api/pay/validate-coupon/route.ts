import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { rateLimit, getIp } from '@/lib/rate-limit'

export async function GET(req: Request) {
  const rl = rateLimit(getIp(req), 30, 60_000) // 30 coupon checks/min per IP
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const productId = searchParams.get('productId')

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('REPLACE_ME')) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  try {
    // First check local DB for coupons linked to this product
    if (productId) {
      const local = await prisma.coupon.findFirst({
        where: { code, productId, active: true },
      })
      if (local) return NextResponse.json(local)
    }

    // Fall back to Stripe promo code lookup
    const promoCodes = await stripe.promotionCodes.list({ code, limit: 1, active: true })
    const promo = promoCodes.data[0]
    if (!promo) throw new Error('Not found')

    const couponId = (promo as unknown as { coupon: { id: string } }).coupon.id
    const coupon = await stripe.coupons.retrieve(couponId)
    return NextResponse.json({
      id: coupon.id,
      name: coupon.name ?? code,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid coupon' }, { status: 404 })
  }
}
