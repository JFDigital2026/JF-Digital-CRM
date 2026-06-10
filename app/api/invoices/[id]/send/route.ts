import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { formatPrice } from '@/lib/stripe'
import { format } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, order: { product: { userId: session.user.id } } },
    include: {
      contact: true,
      order: { include: { product: true } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!invoice.contact.email) return NextResponse.json({ error: 'Contact has no email' }, { status: 422 })

  const html = buildInvoiceHtml(invoice)

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: invoice.contact.email,
      subject: `Invoice ${invoice.number} — ${invoice.order.product.name}`,
      html,
    })
  } catch (err) {
    console.error('Resend send failed:', err)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: 'SENT', sentAt: new Date() },
  })

  return NextResponse.json(updated)
}

function buildInvoiceHtml(invoice: {
  number: string
  amount: number
  currency: string
  createdAt: Date
  contact: { firstName: string; lastName: string; email: string | null }
  order: { product: { name: string; description: string | null }; createdAt: Date }
}): string {
  const contactName = `${invoice.contact.firstName} ${invoice.contact.lastName}`
  const productName = invoice.order.product.name
  const amount = formatPrice(invoice.amount, invoice.currency)
  const date = format(invoice.createdAt, 'MMMM d, yyyy')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto; padding: 32px; }
  .header { background: #0D1B2A; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 24px; }
  .body { border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .total { font-size: 18px; font-weight: bold; margin-top: 16px; text-align: right; }
</style></head>
<body>
  <div class="header">
    <h1>Invoice ${invoice.number}</h1>
    <p style="margin:8px 0 0; opacity:0.8">${date}</p>
  </div>
  <div class="body">
    <p><strong>Bill To:</strong> ${contactName}</p>
    <div class="row"><span>${productName}</span><span>${amount}</span></div>
    <div class="total">Total: ${amount}</div>
    <p style="margin-top:24px;color:#6b7280;font-size:13px">Thank you for your payment.</p>
  </div>
</body>
</html>`
}
