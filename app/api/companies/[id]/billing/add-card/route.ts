import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'
import { requirePermission } from '@/lib/permissions'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('billing', 'manage')
  if (!auth.ok) return auth.response

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

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        metadata: { crmCompanyId: company.id },
      })
      stripeCustomerId = customer.id
      await prisma.company.update({
        where: { id: company.id },
        data: { stripeCustomerId },
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/companies/${params.id}?tab=billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('Customer portal error:', err)
    return NextResponse.json({ error: 'Could not open billing portal. Please try again.' }, { status: 500 })
  }
}
