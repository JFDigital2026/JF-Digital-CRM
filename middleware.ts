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

// Everything a logged-out visitor or a link crawler needs is excluded here:
// the public booking surfaces, static image files in /public, and robots.txt.
// Anything left in still redirects to /login. robots.txt matters specifically
// because crawlers fetch it first, and LinkedIn treats a redirect to a login
// page as "do not crawl", which blocked booking-link previews entirely.
export const config = {
  matcher: [
    '/((?!login|book|reschedule|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|pay|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
}
