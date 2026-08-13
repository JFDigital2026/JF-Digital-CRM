import type { MetadataRoute } from 'next'

// Crawlers request /robots.txt before fetching anything else. Without this file
// the request fell through to the auth middleware and redirected to /login,
// which LinkedIn's crawler treats as "not allowed" — it then refuses to scrape
// the public booking page at all.
//
// This is a private CRM, so only the public surfaces are crawlable.
export default function robots(): MetadataRoute.Robots {
  const publicOrigin = process.env.NEXTAUTH_URL ?? 'http://localhost:4000'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/book/', '/reschedule/', '/pay/'],
        disallow: '/',
      },
    ],
    host: publicOrigin,
  }
}
