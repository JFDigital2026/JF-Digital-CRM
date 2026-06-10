import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import twilio from 'twilio'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { contactId, channel, body: messageBody, subject, toAddress, addressType } = body as {
    contactId?: string
    channel: 'EMAIL' | 'SMS'
    body: string
    subject?: string
    toAddress?: string
    addressType?: 'phone' | 'email'
  }

  if (!channel || !messageBody) {
    return NextResponse.json({ error: 'channel and body are required' }, { status: 400 })
  }
  if (!contactId && !toAddress) {
    return NextResponse.json({ error: 'contactId or toAddress required' }, { status: 400 })
  }

  let contact: any = null

  if (contactId) {
    contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { company: { select: { id: true, name: true } } },
    })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  } else if (toAddress) {
    const addr = toAddress.trim()
    const resolvedType = addressType ?? (addr.includes('@') ? 'email' : 'phone')

    if (resolvedType === 'email') {
      // Find existing real contact first, then unverified, then create unverified
      contact = await prisma.contact.findFirst({
        where: { email: addr, NOT: { tags: { has: '__unverified__' } } },
      })
      if (!contact) {
        contact = await prisma.contact.findFirst({ where: { email: addr } })
      }
      if (!contact) {
        contact = await prisma.contact.create({
          data: { firstName: addr.split('@')[0], lastName: '', email: addr, tags: ['__unverified__'] },
        })
      }
    } else {
      const digits = addr.replace(/\D/g, '').slice(-10)
      contact = await prisma.contact.findFirst({
        where: { phone: { contains: digits }, NOT: { tags: { has: '__unverified__' } } },
      })
      if (!contact) {
        contact = await prisma.contact.findFirst({ where: { phone: { contains: digits } } })
      }
      if (!contact) {
        contact = await prisma.contact.create({
          data: { firstName: addr, lastName: '', phone: addr, tags: ['__unverified__'] },
        })
      }
    }
  }

  if (!contact) return NextResponse.json({ error: 'Could not resolve contact' }, { status: 400 })

  if (channel === 'EMAIL') {
    if (!contact.email) {
      return NextResponse.json({ error: 'Contact has no email' }, { status: 400 })
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
        to: contact.email,
        subject: subject || 'Message from CRM',
        text: messageBody,
      })
    } catch (err) {
      console.error('Email send error:', err)
    }
  }

  if (channel === 'SMS') {
    if (!contact.phone) {
      return NextResponse.json({ error: 'Contact has no phone' }, { status: 400 })
    }
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await client.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: contact.phone,
      })
    } catch (err) {
      console.error('SMS send error:', err)
    }
  }

  const message = await prisma.message.create({
    data: {
      contactId: contact.id,
      direction: 'OUTBOUND',
      channel: channel as any,
      subject: subject || null,
      body: messageBody,
      read: true,
    },
  })

  return NextResponse.json({ ...message, contact }, { status: 201 })
}
