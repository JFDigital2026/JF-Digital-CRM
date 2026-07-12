import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { resolveCouponForCheckout } from '@/lib/coupons'

// Public — no auth (called from payment page)
export async function POST(req: Request) {
  const rl = rateLimit(getIp(req), 20, 60_000) // 20 intents/min per IP
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { productId, contact, couponCode } = await req.json()

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('REPLACE_ME')) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
  })
  if (!product || !product.stripePriceId) {
    return NextResponse.json({ error: 'Product not available' }, { status: 404 })
  }

  // Find or create CRM contact
  let crmContact = await prisma.contact.findFirst({
    where: { email: contact.email, NOT: { tags: { has: '__unverified__' } } },
  })

  if (!crmContact) {
    crmContact = await prisma.contact.create({
      data: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone ?? null,
      },
    })
  }

  // Create pending order
  const order = await prisma.order.create({
    data: {
      contactId: crmContact.id,
      productId: product.id,
      amount: product.price,
      currency: 'usd',
      status: 'PENDING',
    },
  })

  // Resolve the coupon from the CODE server-side. Never trust a coupon id from
  // the client — that would let anyone apply an arbitrary (e.g. 100%-off) coupon.
  let resolvedCouponId: string | null = null
  if (couponCode) {
    const resolved = await resolveCouponForCheckout(String(couponCode), product.id)
    if (resolved) resolvedCouponId = resolved.stripeCouponId
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000'
  const returnUrl = `${appUrl}/pay/${productId}/success?orderId=${order.id}`

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: product.type === 'SUBSCRIPTION' ? 'subscription' : 'payment',
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    customer_email: contact.email,
    metadata: { orderId: order.id, contactId: crmContact.id },
    success_url: returnUrl,
    cancel_url: `${appUrl}/pay/${productId}`,
    ...(resolvedCouponId && { discounts: [{ coupon: resolvedCouponId }] }),
    ...(product.type === 'SUBSCRIPTION' && product.trialDays
      ? { subscription_data: { trial_period_days: product.trialDays } }
      : {}),
  })

  return NextResponse.json({
    clientSecret: session.client_secret,
    sessionUrl: session.url,
    returnUrl,
  })
}
