export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/((?!login|book|reschedule|_next/static|_next/image|favicon.ico|api|pay).*)'],
}
