import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    // Twilio sends application/x-www-form-urlencoded
    const text = await req.text()
    const params = new URLSearchParams(text)

    const from = params.get('From') ?? ''
    const body = params.get('Body') ?? ''
    const messageSid = params.get('MessageSid') ?? undefined

    if (!from || !body) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Normalize phone: strip all non-digits, take last 10 digits
    const normalizedFrom = from.replace(/\D/g, '').slice(-10)

    // Find contact by phone number (partial match on last 10 digits)
    const contact = await prisma.contact.findFirst({
      where: {
        phone: {
          contains: normalizedFrom,
        },
      },
    })

    if (contact) {
      // Create the message
      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: 'INBOUND',
          channel: 'SMS',
          body,
          read: false,
          externalId: messageSid ?? null,
        },
      })

      // Find admin user to notify (first user in system)
      const adminUser = await prisma.user.findFirst({ select: { id: true } })
      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            type: 'MESSAGE_RECEIVED',
            title: 'New SMS Message',
            body: `SMS from ${from}: ${body.slice(0, 100)}`,
            linkUrl: `/inbox`,
          },
        })
      }
    }

    // Always return valid TwiML (empty response = no auto-reply)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('Twilio webhook error:', err)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
