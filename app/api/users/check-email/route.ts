import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

// Only reachable from the authenticated user-management UI. Gated behind
// manageUsers so it can't be used anonymously to enumerate registered accounts.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('settings', 'manageUsers')
  if (!auth.ok) return auth.response

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  const excludeId = req.nextUrl.searchParams.get('excludeId')

  if (!email) return NextResponse.json({ available: false })

  const where: any = { email }
  if (excludeId) where.id = { not: excludeId }

  const existing = await prisma.user.findFirst({ where, select: { id: true } })
  return NextResponse.json({ available: !existing })
}
