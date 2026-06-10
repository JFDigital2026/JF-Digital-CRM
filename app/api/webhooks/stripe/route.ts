import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'
import { triggerAutomation } from '@/lib/automation-engine'

export const config = { api: { bodyParser: false } }

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.orderId) {
          await prisma.order.update({
            where: { id: session.metadata.orderId },
            data: {
              status: 'PAID',
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string ?? null,
            },
          })

          // Auto-generate invoice
          const order = await prisma.order.findUnique({ where: { id: session.metadata.orderId } })
          if (order) {
            const count = await prisma.invoice.count()
            const number = `INV-${String(count + 1).padStart(5, '0')}`
            await prisma.invoice.create({
              data: {
                orderId: order.id,
                contactId: order.contactId,
                number,
                amount: order.amount,
                currency: order.currency,
                status: 'DRAFT',
              },
            })

            if (order.contactId) {
              triggerAutomation('PAYMENT_RECEIVED', order.contactId, { amount: order.amount, orderId: order.id }).catch(() => {})
            }

            // Create notification
            const product = await prisma.product.findUnique({
              where: { id: order.productId },
              select: { userId: true, name: true },
            })
            if (product) {
              await prisma.notification.create({
                data: {
                  userId: product.userId,
                  type: 'PAYMENT_MADE',
                  title: 'Payment received',
                  body: `Payment for ${product.name}`,
                  linkUrl: '/products',
                },
              })
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: {
            status: sub.status === 'active' ? 'ACTIVE' : sub.status === 'past_due' ? 'PAST_DUE' : 'ACTIVE',
            // @ts-expect-error — Stripe type varies by API version
            nextBillingDate: sub.current_period_end ? new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000) : null,
          },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        })
        break
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const invSubId = (inv as unknown as { subscription?: string }).subscription
        if (invSubId) {
          await prisma.subscription.updateMany({
            where: { stripeSubId: invSubId },
            data: { status: 'PAST_DUE' },
          })

          // Find subscription to get userId for notification
          const localSub = await prisma.subscription.findFirst({
            where: { stripeSubId: invSubId },
            include: { product: { select: { userId: true, name: true } } },
          })
          if (localSub) {
            await prisma.notification.create({
              data: {
                userId: localSub.product.userId,
                type: 'PAYMENT_MADE',
                title: 'Payment failed',
                body: `Subscription payment failed for ${localSub.product.name}`,
                linkUrl: '/products',
              },
            })
            if (localSub.contactId) {
              triggerAutomation('PAYMENT_FAILED', localSub.contactId, { subscriptionId: localSub.id }).catch(() => {})
            }
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
