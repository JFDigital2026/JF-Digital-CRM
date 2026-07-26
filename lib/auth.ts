import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { ADMIN_PERMISSIONS, resolveEffectivePermissions } from '@/lib/rolePresets'
import { rateLimit } from '@/lib/rate-limit'

// Re-validate a live JWT against the DB at most this often (seconds). Bounds how
// long a deactivated user or a permissions change can lag behind reality.
const REVALIDATE_INTERVAL = 60

function resolvePermissions(role: string, stored: unknown): Record<string, any> {
  if (role === 'ADMIN') return ADMIN_PERMISSIONS
  // Layer stored overrides on the role preset rather than letting a saved record
  // replace it outright. A record written before a permission existed has no key
  // for it, and an absent key would otherwise read as an explicit denial —
  // silently locking users out of every newly added feature.
  return resolveEffectivePermissions(role, stored)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        trustDevice: { label: 'Trust Device', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // ── Brute-force throttle: 10 attempts / 15 min per IP+email ──────────────
        // Note: in-memory (single instance). Resets on redeploy; use a shared
        // store if this ever scales horizontally.
        const headers = (req?.headers ?? {}) as Record<string, any>
        const fwd =
          typeof headers['x-forwarded-for'] === 'string'
            ? headers['x-forwarded-for']
            : ''
        const ip = String(fwd).split(',')[0].trim() || 'unknown'
        const emailKey = credentials.email.toLowerCase()
        const rl = rateLimit(`login:${ip}:${emailKey}`, 10, 15 * 60 * 1000)
        if (!rl.success) {
          throw new Error('Too many login attempts. Please try again in a few minutes.')
        }

        // Emails are stored lowercased on create/update, so normalize the login
        // input too — otherwise any uppercase char makes a valid account fail to
        // match (Postgres text lookups are case-sensitive).
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        })

        if (!user) return null

        // Check active status
        if (!user.active) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        // Update lastLoginAt
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? `${user.firstName} ${user.lastName}`.trim(),
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          permissions: resolvePermissions(user.role, user.permissions),
          trustDevice: credentials.trustDevice === 'true',
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in
        token.id = user.id
        token.role = (user as any).role
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
        token.department = (user as any).department
        token.permissions = (user as any).permissions
        token.active = true
        token.lastChecked = Math.floor(Date.now() / 1000)
        const trusted = (user as any).trustDevice === true
        if (!trusted) {
          token.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24
        }
        return token
      }

      // Subsequent requests: periodically re-check the account is still active
      // and refresh role/permissions so deactivation and permission changes take
      // effect without waiting for the token to expire.
      const now = Math.floor(Date.now() / 1000)
      const last = (token.lastChecked as number) ?? 0
      if (token.id && now - last > REVALIDATE_INTERVAL) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { active: true, role: true, permissions: true },
        })
        if (!dbUser || !dbUser.active) {
          token.active = false
        } else {
          token.active = true
          token.role = dbUser.role
          token.permissions = resolvePermissions(dbUser.role, dbUser.permissions)
        }
        token.lastChecked = now
      }
      return token
    },
    async session({ session, token }) {
      // Deactivated (or revoked) — hand back a session with no usable identity so
      // every server-side guard treats the request as unauthenticated.
      if (token?.active === false) {
        if (session.user) {
          session.user.id = ''
          session.user.role = ''
          session.user.permissions = undefined
        }
        return session
      }

      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.firstName = token.firstName as string | undefined
        session.user.lastName = token.lastName as string | undefined
        session.user.department = token.department as string | null | undefined
        session.user.permissions = token.permissions as Record<string, any> | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
