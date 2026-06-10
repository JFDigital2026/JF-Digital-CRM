import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!stripeReady()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  try {
    const { retainerStartDate } = await req.json()

    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, stripeCustomerId: true },
    })
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!company.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer on file' }, { status: 400 })
    }

    const stripeCustomerId = company.stripeCustomerId

    // Get default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    if ('deleted' in customer) {
      return NextResponse.json({ error: 'Stripe customer was deleted' }, { status: 400 })
    }
    const defaultPmId = customer.invoice_settings?.default_payment_method
      ? String(customer.invoice_settings.default_payment_method)
      : null
    if (!defaultPmId) {
      return NextResponse.json({ error: 'No default payment method on file' }, { status: 400 })
    }

    // Fetch pending items
    const [pendingOrders, pendingSubscriptions] = await Promise.all([
      prisma.order.findMany({
        where: { companyId: params.id, status: 'PENDING_COMPLETION' },
        include: { product: { select: { name: true, stripeProductId: true } } },
      }),
      prisma.subscription.findMany({
        where: { companyId: params.id, status: 'PENDING' },
        include: { product: { select: { name: true, stripeProductId: true } } },
      }),
    ])

    const errors: string[] = []

    // ── Charge completion orders ──────────────────────────────────────────────
    for (const order of pendingOrders) {
      try {
        const pi = await stripe.paymentIntents.create({
          amount: Math.round(order.amount * 100),
          currency: 'usd',
          customer: stripeCustomerId,
          payment_method: defaultPmId,
          confirm: true,
          off_session: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          description: `Completion payment — ${order.product.name}`,
        })
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID', stripePaymentIntentId: pi.id },
        })
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Charge failed'
        errors.push(`${order.product.name}: ${msg}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 402 })
    }

    // ── Create Stripe subscriptions for pending recurring items ───────────────
    const trialEndTs = retainerStartDate
      ? Math.floor(new Date(retainerStartDate).getTime() / 1000)
      : null

    for (const sub of pendingSubscriptions) {
      try {
        const amount = sub.customAmount ?? 0
        const stripeProductId = sub.product.stripeProductId

        const priceData = stripeProductId
          ? { currency: 'usd', unit_amount: Math.round(amount * 100), recurring: { interval: 'month' }, product: stripeProductId }
          : { currency: 'usd', unit_amount: Math.round(amount * 100), recurring: { interval: 'month' }, product_data: { name: sub.product.name } }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripeSub = await (stripe.subscriptions.create as any)({
          customer: stripeCustomerId,
          items: [{ price_data: priceData }],
          ...(trialEndTs ? { trial_end: trialEndTs } : {}),
        })

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            stripeSubId: stripeSub.id,
            status: 'ACTIVE',
            scheduledStartDate: retainerStartDate ? new Date(retainerStartDate) : null,
            nextBillingDate: retainerStartDate ? new Date(retainerStartDate) : null,
          },
        })
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Subscription creation failed'
        errors.push(`Retainer: ${msg}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 402 })
    }

    // ── Mark company as complete ──────────────────────────────────────────────
    await prisma.company.update({
      where: { id: params.id },
      data: { lastProjectDate: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Mark complete error:', err)
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : 'Failed to mark complete'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
