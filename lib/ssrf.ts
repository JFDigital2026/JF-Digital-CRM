import { lookup } from 'dns/promises'
import net from 'net'

/**
 * SSRF protection for user-supplied outbound URLs (webhook endpoints).
 *
 * Without this, a user could point a webhook at http://169.254.169.254/ (cloud
 * metadata), http://localhost:6379 (internal Redis), etc., and the server would
 * dutifully fetch it — a server-side request forgery. We reject non-http(s)
 * schemes and any host that is (or resolves to) a private / loopback /
 * link-local address.
 */

function stripBrackets(host: string): string {
  return host.replace(/^\[/, '').replace(/\]$/, '')
}

/**
 * Explicit opt-in escape hatch for trusted internal targets (e.g. a self-hosted
 * n8n running on localhost during development). Set WEBHOOK_ALLOWED_LOCAL_HOSTS
 * to a comma-separated list of `host` or `host:port` entries. Empty/unset (the
 * default, and the correct production value) preserves the strict SSRF policy —
 * nothing is exempted. Matching an entry bypasses ONLY the private/loopback
 * rejection; the http(s) scheme check still applies.
 */
function allowlistedLocalHosts(): Set<string> {
  const raw = process.env.WEBHOOK_ALLOWED_LOCAL_HOSTS
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  )
}

function isAllowlistedLocalHost(url: URL): boolean {
  const set = allowlistedLocalHosts()
  if (set.size === 0) return false
  const host = stripBrackets(url.hostname).toLowerCase()
  const hostPort = url.port ? `${host}:${url.port}` : host
  return set.has(host) || set.has(hostPort)
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number)
    if (p[0] === 0) return true // "this" network
    if (p[0] === 10) return true // private
    if (p[0] === 127) return true // loopback
    if (p[0] === 169 && p[1] === 254) return true // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true // private
    if (p[0] === 192 && p[1] === 168) return true // private
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true // CGNAT
    return false
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase()
    if (low === '::1' || low === '::') return true // loopback / unspecified
    if (low.startsWith('fe80')) return true // link-local
    if (low.startsWith('fc') || low.startsWith('fd')) return true // unique local
    const mapped = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/) // IPv4-mapped
    if (mapped) return isPrivateIp(mapped[1])
    return false
  }
  return true // unrecognized → treat as unsafe
}

/**
 * Structural check that needs no DNS. Safe to call synchronously at creation
 * time to give the user fast feedback and reject obvious internal targets.
 */
export function validateWebhookUrlSync(
  raw: string
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http(s) URLs are allowed' }
  }
  // Explicitly trusted internal target (opt-in via env) — skip the internal-host
  // rejection but keep the scheme check that ran above.
  if (isAllowlistedLocalHost(url)) {
    return { ok: true, url }
  }
  const host = stripBrackets(url.hostname).toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return { ok: false, reason: 'Internal hostnames are not allowed' }
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    return { ok: false, reason: 'Private/loopback IP addresses are not allowed' }
  }
  return { ok: true, url }
}

/**
 * Full check including DNS resolution. Call this right before fetching so a
 * hostname that resolves to a private IP (DNS-rebinding style) is also blocked.
 * Throws on any violation.
 */
export async function assertPublicWebhookUrl(raw: string): Promise<void> {
  const sync = validateWebhookUrlSync(raw)
  if (!sync.ok) throw new Error(sync.reason)

  // Trusted internal target (opt-in via env): already accepted by the sync
  // check; skip DNS re-validation so its loopback IP is not re-rejected here.
  if (isAllowlistedLocalHost(sync.url)) return

  const host = stripBrackets(sync.url.hostname)
  if (net.isIP(host)) return // literal IP already validated

  let addrs: { address: string }[]
  try {
    addrs = await lookup(host, { all: true })
  } catch {
    throw new Error('DNS resolution failed')
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new Error('Host resolves to a private IP address')
    }
  }
}
