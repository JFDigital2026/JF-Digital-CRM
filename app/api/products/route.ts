import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripeReady, stripe } from '@/lib/stripe'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const includeArchived = searchParams.get('includeArchived') === 'true'

  const products = await prisma.product.findMany({
    where: {
      userId: session.user.id,
      ...(!includeArchived && { archivedAt: null }),
    },
    include: { coupons: { where: { active: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ products })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, type, price, interval, intervalCount, intervalUnit, trialDays, planCount, planAmount, paymentFrequency, setupFee, price6Month, price12Month, price18Month, active } = body

  let stripeProductId: string | undefined
  let stripePriceId: string | undefined

  if (stripeReady()) {
    try {
      const stripeProduct = await stripe.products.create({
        name,
        description: description ?? undefined,
        metadata: { crmProductType: type },
      })
      stripeProductId = stripeProduct.id

      const priceData: Parameters<typeof stripe.prices.create>[0] = {
        product: stripeProduct.id,
        currency: 'usd',
        unit_amount: Math.round(price * 100),
      }

      if (type === 'SUBSCRIPTION') {
        priceData.recurring = {
          interval: interval === 'ANNUAL' ? 'year' : 'month',
          ...(trialDays ? { trial_period_days: trialDays } : {}),
        }
      }

      const stripePrice = await stripe.prices.create(priceData)
      stripePriceId = stripePrice.id
    } catch (err) {
      console.error('Stripe product creation failed:', err)
    }
  }

  const product = await prisma.product.create({
    data: {
      name,
      description: description ?? null,
      type,
      price,
      interval: interval ?? null,
      intervalCount: intervalCount ?? null,
      intervalUnit: intervalUnit ?? null,
      trialDays: trialDays ?? null,
      planCount: planCount ?? null,
      planAmount: planAmount ?? null,
      paymentFrequency: paymentFrequency ?? null,
      setupFee: setupFee ?? null,
      price6Month: price6Month ?? null,
      price12Month: price12Month ?? null,
      price18Month: price18Month ?? null,
      active: active ?? true,
      stripeProductId: stripeProductId ?? null,
      stripePriceId: stripePriceId ?? null,
      userId: session.user.id,
    },
    include: { coupons: true },
  })

  return NextResponse.json(product, { status: 201 })
}
