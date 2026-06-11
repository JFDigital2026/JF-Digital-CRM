import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export function checkPermission(
  permissions: Record<string, any>,
  role: string,
  module: string,
  action: string
): boolean {
  if (role === 'ADMIN') return true
  const mod = permissions?.[module]
  if (!mod) return false
  return mod[action] === true
}

export function requirePermission(module: string, action: string) {
  return async function permissionMiddleware(
    req: NextRequest,
    handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
    ...args: any[]
  ): Promise<NextResponse> {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, permissions: true, active: true },
    })
    if (!user || !user.active) {
      return NextResponse.json({ success: false, error: { code: 'DEACTIVATED', message: 'Account deactivated.' } }, { status: 403 })
    }
    const allowed = checkPermission(user.permissions as Record<string, any>, user.role, module, action)
    if (!allowed) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } }, { status: 403 })
    }
    return handler(req, ...args)
  }
}
