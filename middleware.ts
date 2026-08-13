import { withAuth } from 'next-auth/middleware'

// Protects app pages. Beyond requiring a valid session, this rejects tokens whose
// account has been marked inactive (token.active === false) by the jwt callback,
// so deactivated users lose page access once their token is next revalidated.
export default withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => !!token && token.active !== false,
  },
})

// Static image files in /public are excluded too. Without that, assets like the
// logo on the public booking page get redirected to /login for logged-out
// visitors and render broken.
export const config = {
  matcher: [
    '/((?!login|book|reschedule|_next/static|_next/image|favicon.ico|api|pay|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
}
