import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'
import { requirePermission } from '@/lib/permissions'
import { getCompanyCustomerId, paymentMethodBelongsToCompany } from '@/lib/billing-auth'

// DELETE — detach a card
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('billing', 'manage')
  if (!auth.ok) return auth.response
  if (!stripeReady()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  try {
    const { paymentMethodId } = await req.json()
    if (!paymentMethodId) return NextResponse.json({ error: 'paymentMethodId required' }, { status: 400 })

    // Ensure the card actually belongs to this company before detaching.
    if (!(await paymentMethodBelongsToCompany(params.id, paymentMethodId))) {
      return NextResponse.json({ error: 'Payment method not found for this company' }, { status: 404 })
    }

    await stripe.paymentMethods.detach(paymentMethodId)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — make primary OR update expiry
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('billing', 'manage')
  if (!auth.ok) return auth.response
  if (!stripeReady()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  try {
    const body = await req.json()
    const { action, paymentMethodId, expMonth, expYear } = body

    if (!paymentMethodId) return NextResponse.json({ error: 'paymentMethodId required' }, { status: 400 })

    // Every mutation targets a payment method — verify ownership up front.
    if (!(await paymentMethodBelongsToCompany(params.id, paymentMethodId))) {
      return NextResponse.json({ error: 'Payment method not found for this company' }, { status: 404 })
    }

    if (action === 'make_primary') {
      const customerId = await getCompanyCustomerId(params.id)
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
