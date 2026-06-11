import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      firstName?: string
      lastName?: string
      department?: string | null
      permissions?: Record<string, any>
    }
  }

  interface User {
    id: string
    role: string
    trustDevice?: boolean
    firstName?: string
    lastName?: string
    department?: string | null
    permissions?: Record<string, any>
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    firstName?: string
    lastName?: string
    department?: string | null
    permissions?: Record<string, any>
  }
}
