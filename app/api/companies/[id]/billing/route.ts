import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, stripeCustomerId: true },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [subscriptions, orders, invoices] = await Promise.all([
    prisma.subscription.findMany({
      where: { companyId: params.id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        product: { select: { id: true, name: true, type: true, interval: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { companyId: params.id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        product: { select: { id: true, name: true, type: true } },
        invoices: { select: { id: true, number: true, status: true, sentAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { order: { companyId: params.id } },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        order: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Fetch Stripe payment methods — prefer Company.stripeCustomerId, fall back to active sub
  let paymentMethods: { id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean }[] = []
  if (stripeReady()) {
    const customerId =
      company.stripeCustomerId ??
      subscriptions.find((s) => s.stripeCustomerId)?.stripeCustomerId
    if (customerId) {
      try {
        const [pms, customer] = await Promise.all([
          stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
          stripe.customers.retrieve(customerId),
        ])
        const defaultPmId =
          !('deleted' in customer) && customer.invoice_settings?.default_payment_method
            ? String(customer.invoice_settings.default_payment_method)
            : null
        paymentMethods = pms.data.map((pm) => {
          const c = (pm as unknown as { card: { brand: string; last4: string; exp_month: number; exp_year: number } }).card
          return {
            id: pm.id,
            brand: c.brand,
            last4: c.last4,
            expMonth: c.exp_month,
            expYear: c.exp_year,
            isDefault: pm.id === defaultPmId,
          }
        })
      } catch (err) {
        console.error('Stripe payment methods fetch failed:', err)
      }
    }
  }

  return NextResponse.json({ subscriptions, orders, invoices, paymentMethods })
  } catch (err) {
    console.error('Billing route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
