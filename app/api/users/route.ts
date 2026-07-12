import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getPresetForRole } from '@/lib/rolePresets'

const USER_SELECT = {
  id: true, firstName: true, lastName: true, name: true,
  email: true, role: true, department: true, title: true,
  active: true, permissions: true, createdByUserId: true,
  createdAt: true, lastLoginAt: true, avatarUrl: true,
  createdByUser: { select: { id: true, firstName: true, lastName: true, name: true } },
} as const

// Returns the session plus whether the requester is a true ADMIN. manageUsers
// grants user-management access, but only a real ADMIN may hand-craft permission
// sets on the users they create (prevents privilege escalation).
async function requireAdmin(): Promise<{ session: Session; isAdmin: boolean } | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, active: true, permissions: true },
  })
  if (!user?.active) return null
  if (user.role === 'ADMIN') return { session, isAdmin: true }
  const perms = user.permissions as Record<string, any>
  if (perms?.settings?.manageUsers === true) return { session, isAdmin: false }
  return null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { session, isAdmin } = admin

    const body = await req.json()
    const { firstName, lastName, email, password, role, department, title, permissions } = body

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot create ADMIN users' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const hash = await bcrypt.hash(password, 12)
    // Only a true ADMIN may supply a custom permission set. Non-admin creators
    // always get the role's preset, so they cannot mint an over-privileged user.
    const resolvedPermissions = isAdmin && permissions && Object.keys(permissions).length > 0
      ? permissions
      : getPresetForRole(role ?? 'SALES_REP')

    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim().toLowerCase(),
        password: hash,
        role: role ?? 'SALES_REP',
        department: department?.trim() || null,
        title: title?.trim() || null,
        permissions: resolvedPermissions,
        createdByUserId: session.user.id,
        active: true,
      },
      select: USER_SELECT,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/users]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
