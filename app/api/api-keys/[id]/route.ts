import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

// Owner may manage their own keys; an ADMIN may revoke any user's key (needed to
// cut off a deactivated employee's keys).
function canManageKey(keyUserId: string, session: { user: { id: string; role: string } }): boolean {
  return keyUserId === session.user.id || session.user.role === 'ADMIN'
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageApi')
  if (!auth.ok) return auth.response

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } })
  if (!key || !canManageKey(key.userId, auth.session)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.apiKey.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageApi')
  if (!auth.ok) return auth.response

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } })
  if (!key || !canManageKey(key.userId, auth.session)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { active } = await req.json()
  const updated = await prisma.apiKey.update({
    where: { id: params.id },
    data: { ...(active !== undefined && { active }) },
  })

  return NextResponse.json({ key: updated })
}
