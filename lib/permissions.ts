import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveEffectivePermissions } from '@/lib/rolePresets'

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

/**
 * Boolean permission check against an already-loaded session. Mirrors the
 * resolution logic in requirePermission (stored overrides layered on the role
 * preset, ADMIN always true) for callers that need to branch on a permission
 * without returning a response — e.g. picking the right module based on a
 * record's relations.
 */
export function can(session: Session, module: string, action: string): boolean {
  const role = session.user.role
  const perms = resolveEffectivePermissions(role, session.user.permissions)
  return checkPermission(perms as Record<string, any>, role, module, action)
}

export type PermissionResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }

/**
 * Server-side permission guard for route handlers.
 *
 * Usage:
 *   const auth = await requirePermission('contacts', 'delete')
 *   if (!auth.ok) return auth.response
 *   const session = auth.session
 *
 * Reads role + permissions from the session JWT (no DB round-trip). ADMIN always
 * passes. Stored overrides are layered on the role preset, so a permission added
 * to the code after a user's record was saved falls back to their role's default
 * rather than reading as an explicit denial.
 */
export async function requirePermission(
  module: string,
  action: string
): Promise<PermissionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const role = session.user.role
  const perms = resolveEffectivePermissions(role, session.user.permissions)

  if (!checkPermission(perms as Record<string, any>, role, module, action)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, session }
}
