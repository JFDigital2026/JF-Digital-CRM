import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim().toLowerCase()
  const phone = searchParams.get('phone')?.trim()

  if (!email && !phone) {
    return NextResponse.json({ found: false })
  }

  let contact = null

  // Email first — most reliable
  if (email) {
    contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    })
  }

  // Phone fallback — normalize both sides before comparing
  if (!contact && phone) {
    const normalized = normalizePhone(phone)
    if (normalized.length >= 7) {
      const candidates = await prisma.contact.findMany({
        where: { phone: { not: null } },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      })
      contact = candidates.find((c) => c.phone && normalizePhone(c.phone) === normalized) ?? null
    }
  }

  if (!contact) return NextResponse.json({ found: false })

  return NextResponse.json({
    found: true,
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
    },
  })
}
