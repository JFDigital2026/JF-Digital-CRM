import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!stripeReady()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, stripeCustomerId: true },
    })
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let stripeCustomerId = company.stripeCustomerId

    const createCustomer = async () => {
      const customer = await stripe.customers.create({
        name: company.name,
        metadata: { crmCompanyId: company.id },
      })
      await prisma.company.update({
        where: { id: company.id },
        data: { stripeCustomerId: customer.id },
      })
      return customer.id
    }

    if (!stripeCustomerId) {
      stripeCustomerId = await createCustomer()
    }

    // Attempt setup intent — if the stored customer is from the wrong Stripe mode
    // (live vs test), recreate it automatically rather than showing a confusing error.
    let setupIntent
    try {
      setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      })
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : null
      const msg  = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : ''
      if (code === 'resource_missing' || msg.includes('No such customer')) {
        // Stale customer ID (likely live→test mode switch) — create a fresh one
        stripeCustomerId = await createCustomer()
        setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        })
      } else {
        throw err
      }
    }

    return NextResponse.json({ clientSecret: setupIntent.client_secret, customerId: stripeCustomerId })
  } catch (err: unknown) {
    console.error('Setup intent error:', err)
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Failed to create setup intent'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
