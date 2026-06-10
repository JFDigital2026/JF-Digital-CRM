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
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
