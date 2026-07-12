import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

const TOLERANCE_SECONDS = 5 * 60 // reject timestamps older/newer than 5 min (replay guard)

// Resend signs webhooks with Svix. Signed content is `${id}.${timestamp}.${body}`,
// HMAC-SHA256 keyed by the base64 secret (after the "whsec_" prefix), base64-encoded.
// The svix-signature header is a space-delimited list of `v1,<sig>` entries.
function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  signatureHeader: string
): boolean {
  const ts = parseInt(svixTimestamp, 10)
  if (!Number.isFinite(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  const provided = signatureHeader
    .split(' ')
    .map((part) => (part.includes(',') ? part.split(',')[1] : part))
    .filter(Boolean)

  const expectedBuf = Buffer.from(expected)
  return provided.some((sig) => {
    const sigBuf = Buffer.from(sig)
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
  })
}

export async function POST(req: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET
    const svixId = req.headers.get('svix-id') ?? ''
    const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
    const svixSignature = req.headers.get('svix-signature') ?? ''

    // Raw body is required for signature verification — read text, then parse.
    const raw = await req.text()

    // Fail closed: without a configured secret we cannot verify the sender.
    if (!secret) {
      console.error('Resend webhook: RESEND_WEBHOOK_SECRET not set — rejecting unverified request')
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (
      !svixId ||
      !svixTimestamp ||
      !svixSignature ||
      !verifySvixSignature(secret, svixId, svixTimestamp, raw, svixSignature)
    ) {
      console.error('Resend webhook: invalid signature')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const data = JSON.parse(raw)

    // Resend inbound webhook payload fields (may vary):
    // data.from or data.sender — sender address like "John Doe <john@example.com>"
    // data.subject — email subject
    // data.text / data.html — body
    // data.messageId or data.id — unique message ID
    const fromRaw: string = data.from ?? data.sender ?? ''
    const subject: string = data.subject ?? ''
    const body: string =
      data.text ??
      (data.html ? (data.html as string).replace(/<[^>]+>/g, ' ').trim() : '') ??
      ''
    const messageId: string | null = data.messageId ?? data.id ?? null

    // Extract email address from "Name <email>" format
    const emailMatch = fromRaw.match(/<([^>]+)>/)
    const email = emailMatch ? emailMatch[1] : fromRaw.trim()

    if (!email) {
      return NextResponse.json({ ok: true })
    }

    // Find contact by email
    const contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })

    if (contact) {
      // Avoid duplicate messages by externalId
      if (messageId) {
        const existing = await prisma.message.findFirst({
          where: { externalId: messageId },
        })
        if (existing) return NextResponse.json({ ok: true })
      }

      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: 'INBOUND',
          channel: 'EMAIL',
          subject: subject || null,
          body: body || '(empty)',
          read: false,
          externalId: messageId,
        },
      })

      const adminUser = await prisma.user.findFirst({ select: { id: true } })
      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            type: 'MESSAGE_RECEIVED',
            title: 'New Email Reply',
            body: `Reply from ${email}: ${(body || '').slice(0, 100)}`,
            linkUrl: `/inbox`,
          },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend webhook error:', err)
    // Verified-but-malformed payloads: ack to avoid retry storms.
    return NextResponse.json({ ok: true })
  }
}
