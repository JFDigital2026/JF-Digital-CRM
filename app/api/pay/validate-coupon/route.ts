import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { resolveCouponForCheckout } from '@/lib/coupons'

export async function GET(req: Request) {
  const rl = rateLimit(getIp(req), 30, 60_000) // 30 coupon checks/min per IP
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const productId = searchParams.get('productId')

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('REPLACE_ME')) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  // Ensure the product exists/active before validating against it.
  const product = await prisma.product.findFirst({ where: { id: productId, active: true }, select: { id: true } })
  if (!product) return NextResponse.json({ error: 'Product not available' }, { status: 404 })

  const resolved = await resolveCouponForCheckout(code, productId)
  if (!resolved) return NextResponse.json({ error: 'Invalid coupon' }, { status: 404 })

  // Return only display info. The client re-sends the CODE at checkout; the
  // server resolves the coupon again, so no coupon id is trusted from the client.
  return NextResponse.json({
    valid: true,
    name: resolved.name,
    percentOff: resolved.percentOff,
    amountOff: resolved.amountOff,
  })
}
