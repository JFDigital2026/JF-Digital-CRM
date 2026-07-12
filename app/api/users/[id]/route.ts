import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const USER_SELECT = {
  id: true, firstName: true, lastName: true, name: true,
  email: true, role: true, department: true, title: true,
  active: true, permissions: true, createdByUserId: true,
  createdAt: true, lastLoginAt: true, avatarUrl: true,
  createdByUser: { select: { id: true, firstName: true, lastName: true, name: true } },
} as const

// Returns the session plus whether the requester is a true ADMIN.
// manageUsers grants access to user management, but only a real ADMIN may
// assign roles or hand-craft permission sets (prevents privilege escalation).
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { session, isAdmin } = admin

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { role: true, id: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.role === 'ADMIN' && target.id !== session.user.id) {
    return NextResponse.json({ error: 'Cannot edit the ADMIN account' }, { status: 403 })
  }

  const body = await req.json()
  const { firstName, lastName, email, role, department, title, permissions } = body

  // Prevent role change to ADMIN
  if (role === 'ADMIN') {
    return NextResponse.json({ error: 'Cannot assign ADMIN role' }, { status: 400 })
  }

  // Only a true ADMIN may change roles or hand-craft permissions. A manageUsers
  // manager attempting either is rejected outright (no silent drop) so the caller
  // knows the change did not take effect.
  if (!isAdmin && (role !== undefined || permissions !== undefined)) {
    return NextResponse.json(
      { error: 'Only an administrator can change roles or permissions.' },
      { status: 403 }
    )
  }

  const updateData: Record<string, any> = {}
  if (firstName !== undefined) { updateData.firstName = firstName.trim(); updateData.name = `${firstName.trim()} ${(lastName ?? '').trim()}`.trim() }
  if (lastName !== undefined) { updateData.lastName = lastName.trim(); updateData.name = `${(firstName ?? updateData.firstName ?? '').trim()} ${lastName.trim()}`.trim() }
  if (email !== undefined) updateData.email = email.trim().toLowerCase()
  if (role !== undefined) updateData.role = role
  if (department !== undefined) updateData.department = department?.trim() || null
  if (title !== undefined) updateData.title = title?.trim() || null
  if (permissions !== undefined) updateData.permissions = permissions

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: USER_SELECT,
  })

  return NextResponse.json(updated)
}
