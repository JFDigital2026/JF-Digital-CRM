import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

// Twilio request validation (https://www.twilio.com/docs/usage/security#validating-requests):
// HMAC-SHA1 over the full request URL + POST params (sorted by key, concatenated
// key+value), keyed by the account auth token, base64-encoded.
function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) data += key + params[key]

  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')

  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function twiml() {
  return new Response(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(req: Request) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const signature = req.headers.get('x-twilio-signature') ?? ''

    // Twilio sends application/x-www-form-urlencoded
    const text = await req.text()
    const params = new URLSearchParams(text)
    const paramObj: Record<string, string> = {}
    params.forEach((value, key) => {
      paramObj[key] = value
    })

    // Fail closed: without a configured auth token we cannot verify the sender.
    if (!authToken) {
      console.error('Twilio webhook: TWILIO_AUTH_TOKEN not set — rejecting unverified request')
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Reconstruct the public URL Twilio signed (proto/host come from the proxy).
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    const host = req.headers.get('host') ?? ''
    const u = new URL(req.url)
    const publicUrl = `${proto}://${host}${u.pathname}${u.search}`

    if (!signature || !validateTwilioSignature(authToken, signature, publicUrl, paramObj)) {
      console.error('Twilio webhook: invalid signature')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const from = params.get('From') ?? ''
    const body = params.get('Body') ?? ''
    const messageSid = params.get('MessageSid') ?? undefined

    if (!from || !body) {
      return twiml()
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
    return twiml()
  } catch (err) {
    console.error('Twilio webhook error:', err)
    return twiml()
  }
}
