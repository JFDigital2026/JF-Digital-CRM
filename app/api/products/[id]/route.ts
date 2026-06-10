import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, stripeReady } from '@/lib/stripe'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { coupons: true },
  })

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const current = await prisma.product.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sync name/description to Stripe if product exists there
  if (stripeReady() && current.stripeProductId && (body.name !== undefined || body.description !== undefined)) {
    try {
      await stripe.products.update(current.stripeProductId, {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description ?? undefined }),
      })
    } catch (err) {
      console.error('Stripe product update failed:', err)
    }
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.price !== undefined) updateData.price = body.price
  if (body.interval !== undefined) updateData.interval = body.interval ?? null
  if (body.intervalCount !== undefined) updateData.intervalCount = body.intervalCount ?? null
  if (body.intervalUnit !== undefined) updateData.intervalUnit = body.intervalUnit ?? null
  if (body.trialDays !== undefined) updateData.trialDays = body.trialDays ?? null
  if (body.planCount !== undefined) updateData.planCount = body.planCount ?? null
  if (body.planAmount !== undefined) updateData.planAmount = body.planAmount ?? null
  if (body.paymentFrequency !== undefined) updateData.paymentFrequency = body.paymentFrequency ?? null
  if (body.setupFee !== undefined) updateData.setupFee = body.setupFee ?? null
  if (body.price6Month !== undefined) updateData.price6Month = body.price6Month ?? null
  if (body.price12Month !== undefined) updateData.price12Month = body.price12Month ?? null
  if (body.price18Month !== undefined) updateData.price18Month = body.price18Month ?? null
  if (body.active !== undefined) updateData.active = body.active
  if (body.archive === true) updateData.archivedAt = new Date()
  if (body.archive === false) updateData.archivedAt = null

  const product = await prisma.product.update({
    where: { id: params.id },
    data: updateData,
    include: { coupons: true },
  })

  return NextResponse.json(product)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await prisma.product.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (stripeReady() && product.stripeProductId) {
    try {
      await stripe.products.update(product.stripeProductId, { active: false })
    } catch (err) {
      console.error('Stripe product deactivation failed:', err)
    }
  }

  await prisma.product.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
