import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { ADMIN_PERMISSIONS, getPresetForRole } from '@/lib/rolePresets'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        trustDevice: { label: 'Trust Device', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
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

        // Resolve permissions: ADMIN always gets full perms, others get stored or preset
        let permissions: Record<string, any>
        if (user.role === 'ADMIN') {
          permissions = ADMIN_PERMISSIONS
        } else {
          const stored = user.permissions as Record<string, any>
          permissions = Object.keys(stored).length > 0 ? stored : getPresetForRole(user.role)
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? `${user.firstName} ${user.lastName}`.trim(),
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          permissions,
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
        token.id = user.id
        token.role = (user as any).role
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
        token.department = (user as any).department
        token.permissions = (user as any).permissions
        const trusted = (user as any).trustDevice === true
        if (!trusted) {
          token.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24
        }
      }
      return token
    },
    async session({ session, token }) {
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
