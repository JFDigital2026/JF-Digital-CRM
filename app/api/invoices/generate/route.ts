import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await req.json()

  const order = await prisma.order.findFirst({
    where: { id: orderId, product: { userId: session.user.id } },
    include: {
      contact: true,
      product: true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Check if invoice already exists
  const existing = await prisma.invoice.findFirst({ where: { orderId } })
  if (existing) return NextResponse.json(existing)

  const count = await prisma.invoice.count()
  const number = `INV-${String(count + 1).padStart(5, '0')}`

  const invoice = await prisma.invoice.create({
    data: {
      orderId,
      contactId: order.contactId,
      number,
      amount: order.amount,
      currency: order.currency,
      status: 'DRAFT',
    },
    include: {
      contact: true,
      order: { include: { product: true } },
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}
