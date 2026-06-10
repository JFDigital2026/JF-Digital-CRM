import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const data = await req.json()

    // Resend inbound webhook payload fields (may vary):
    // data.from or data.sender — sender address like "John Doe <john@example.com>"
    // data.to — array or string of recipients
    // data.subject — email subject
    // data.text — plain text body
    // data.html — HTML body
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
    return NextResponse.json({ ok: true }) // Always return 200 to prevent retries
  }
}
