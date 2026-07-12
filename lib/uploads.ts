import { existsSync } from 'fs'
import { join, resolve, sep } from 'path'

// Private storage root for uploaded files — outside public/, so nothing is
// served statically. Override with UPLOAD_DIR (e.g. a mounted volume) in prod;
// on Railway's ephemeral disk, a volume is recommended for persistence.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim().length > 0
    ? resolve(process.env.UPLOAD_DIR)
    : join(process.cwd(), 'uploads')

// Files uploaded before the private-storage change lived under public/uploads.
export const LEGACY_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

/**
 * Resolve a stored FileAttachment.url to an absolute on-disk path, guaranteeing
 * the result stays within an allowed base directory. Returns null if the file
 * cannot be found in a safe location — which also blocks path-traversal payloads
 * (e.g. "../../etc/passwd") because the resolved path fails the containment check.
 */
export function resolveStoredFilePath(storedUrl: string): string | null {
  // Normalize so both new ("contacts/x.pdf") and legacy ("/uploads/contacts/x.pdf")
  // forms resolve identically.
  const rel = storedUrl.replace(/^\/+/, '').replace(/^uploads\//, '')
  if (!rel) return null

  for (const base of [UPLOAD_DIR, LEGACY_UPLOAD_DIR]) {
    const abs = resolve(base, rel)
    const contained = abs === base || abs.startsWith(base + sep)
    if (contained && existsSync(abs)) return abs
  }
  return null
}
