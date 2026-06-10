import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'

async function getCustomerId(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { stripeCustomerId: true },
  })
  return company?.stripeCustomerId ?? null
}

// DELETE — detach a card
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!stripeReady()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  try {
    const { paymentMethodId } = await req.json()
    if (!paymentMethodId) return NextResponse.json({ error: 'paymentMethodId required' }, { status: 400 })

    await stripe.paymentMethods.detach(paymentMethodId)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — make primary OR update expiry
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!stripeReady()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  try {
    const body = await req.json()
    const { action, paymentMethodId, expMonth, expYear } = body

    if (action === 'make_primary') {
      const customerId = await getCustomerId(params.id)
      if (!customerId) return NextResponse.json({ error: 'No Stripe customer' }, { status: 404 })

      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'update_expiry') {
      await stripe.paymentMethods.update(paymentMethodId, {
        card: { exp_month: expMonth, exp_year: expYear },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
