import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  const excludeId = req.nextUrl.searchParams.get('excludeId')

  if (!email) return NextResponse.json({ available: false })

  const where: any = { email }
  if (excludeId) where.id = { not: excludeId }

  const existing = await prisma.user.findFirst({ where, select: { id: true } })
  return NextResponse.json({ available: !existing })
}
