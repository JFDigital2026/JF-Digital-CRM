import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'

type ServiceLine = {
  productId: string
  amount: number
  chargeType: 'deposit' | 'on_completion' | 'recurring'
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!stripeReady()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const {
      companyName,
      firstName,
      lastName,
      email,
      phone,
      street,
      city,
      state,
      zip,
      country = 'US',
      paymentMethodId,
      existingCompanyId,
      services = [] as ServiceLine[],
    } = body

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // ── Step 1: Stripe first — if this fails, nothing goes in the DB ──────────

    let stripeCustomerId: string | null = null

    if (paymentMethodId && stripe) {
      if (existingCompanyId) {
        const existing = await prisma.company.findUnique({
          where: { id: existingCompanyId },
          select: { stripeCustomerId: true },
        })
        stripeCustomerId = existing?.stripeCustomerId ?? null
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          name: companyName,
          email: email || undefined,
          phone: phone || undefined,
          address: street ? {
            line1: street,
            city: city || undefined,
            state: state || undefined,
            postal_code: zip || undefined,
            country,
          } : undefined,
          metadata: { crmCompanyId: existingCompanyId ?? 'pending' },
        })
        stripeCustomerId = customer.id
      }

      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId })
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })

      // Charge deposit services immediately before any DB writes
      for (const svc of services as ServiceLine[]) {
        if (svc.chargeType !== 'deposit') continue
        await stripe.paymentIntents.create({
          amount: Math.round(svc.amount * 100),
          currency: 'usd',
          customer: stripeCustomerId,
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          description: `Deposit — ${svc.productId}`,
        })
      }
    }

    // ── Step 2: DB ────────────────────────────────────────────────────────────

    let companyId: string

    if (existingCompanyId) {
      companyId = existingCompanyId
      if (stripeCustomerId) {
        await prisma.company.update({
          where: { id: companyId },
          data: { stripeCustomerId },
        })
      }
    } else {
      const company = await prisma.company.create({
        data: {
          name: companyName,
          address: street || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          country: country || null,
          stripeCustomerId,
        },
      })
      companyId = company.id

      if (stripeCustomerId && stripe) {
        await stripe.customers.update(stripeCustomerId, {
          metadata: { crmCompanyId: companyId },
        })
      }
    }

    let contactId: string | null = null
    if (firstName) {
      const contact = await prisma.contact.create({
        data: {
          firstName,
          lastName: lastName || '',
          email: email || null,
          phone: phone || null,
          companyId,
        },
      })
      contactId = contact.id
    }

    // ── Step 3: Create service records ────────────────────────────────────────

    for (const svc of services as ServiceLine[]) {
      if (svc.chargeType === 'deposit') {
        await prisma.order.create({
          data: {
            contactId,
            companyId,
            productId: svc.productId,
            amount: svc.amount,
            status: 'PAID',
          },
        })
      } else if (svc.chargeType === 'on_completion') {
        await prisma.order.create({
          data: {
            contactId,
            companyId,
            productId: svc.productId,
            amount: svc.amount,
            status: 'PENDING_COMPLETION',
          },
        })
      } else if (svc.chargeType === 'recurring') {
        await prisma.subscription.create({
          data: {
            contactId,
            companyId,
            productId: svc.productId,
            customAmount: svc.amount,
            status: 'PENDING',
            stripeCustomerId,
          },
        })
      }
    }

    return NextResponse.json({ companyId })
  } catch (err: unknown) {
    console.error('Enrollment error:', err)

    if (err && typeof err === 'object' && 'type' in err) {
      const e = err as unknown as { message?: string; code?: string }
      if (e.message) return NextResponse.json({ error: e.message, code: e.code }, { status: 402 })
    }

    return NextResponse.json({ error: 'Enrollment failed. Please try again.' }, { status: 500 })
  }
}
