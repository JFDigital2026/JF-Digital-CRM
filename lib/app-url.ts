/**
 * Public origin of this deployment, e.g. "https://crm.example.com".
 *
 * Google OAuth requires the redirect_uri sent on the authorize call to match
 * the one sent on the token exchange *and* to be registered on the OAuth client
 * — byte for byte. Several routes were reading NEXT_PUBLIC_APP_URL on its own,
 * which is not set in production (only NEXTAUTH_URL is, per .env.example), so
 * the redirect_uri built as the literal string "undefined/api/..." and Google
 * rejected it with redirect_uri_mismatch.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL — explicit override when the public origin differs
 *      from the auth origin.
 *   2. NEXTAUTH_URL        — already holds the public origin in every environment.
 *   3. The incoming request's origin — last resort so local dev works on
 *      whatever port it happens to be running on.
 *
 * Always call this with the request when one is available: it is the only
 * source that stays correct when the app is reached on an unexpected host.
 */
export function getAppUrl(req?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/+$/, '')

  if (req) {
    try {
      return new URL(req.url).origin
    } catch {
      // fall through
    }
  }

  return 'http://localhost:4000'
}
