import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getIp } from '@/lib/rate-limit'

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function GET(req: Request) {
  // Public endpoint (booking "welcome back" flow). Throttle hard per IP so it
  // can't be used to enumerate contacts / harvest PII.
  const rl = rateLimit(`lookup:${getIp(req)}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json({ found: false }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim().toLowerCase()
  const phone = searchParams.get('phone')?.trim()

  if (!email && !phone) {
    return NextResponse.json({ found: false })
  }

  let contact: { id: string; firstName: string } | null = null

  // Email first — most reliable
  if (email) {
    contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firstName: true },
    })
  }

  // Phone fallback — normalize both sides before comparing
  if (!contact && phone) {
    const normalized = normalizePhone(phone)
    if (normalized.length >= 7) {
      const candidates = await prisma.contact.findMany({
        where: { phone: { not: null } },
        select: { id: true, firstName: true, phone: true },
      })
      const match = candidates.find((c) => c.phone && normalizePhone(c.phone) === normalized)
      contact = match ? { id: match.id, firstName: match.firstName } : null
    }
  }

  if (!contact) return NextResponse.json({ found: false })

  // Bare minimum: an id to link the booking + first name for the greeting. No
  // email/phone/last name is echoed back, so a guessed identifier reveals nothing new.
  return NextResponse.json({
    found: true,
    contact: { id: contact.id, firstName: contact.firstName },
  })
}
