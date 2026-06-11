'use client'

import { useSession } from 'next-auth/react'
import { ADMIN_PERMISSIONS } from '@/lib/rolePresets'

export function usePermissions() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const permissions = session?.user?.permissions ?? (role === 'ADMIN' ? ADMIN_PERMISSIONS : {})

  function can(module: string, action: string): boolean {
    if (role === 'ADMIN') return true
    const mod = (permissions as Record<string, any>)?.[module]
    if (!mod) return false
    return mod[action] === true
  }

  return { can, permissions, role }
}
