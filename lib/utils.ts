import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a query-string integer, falling back when it's missing or non-numeric.
 * `parseInt('abc', 10)` is NaN and `Math.max(1, NaN)` stays NaN — passing that to
 * Prisma's skip/take throws a 500, so callers must never hand raw parseInt output
 * to the DB. Always base-10; optional min/max clamp.
 */
export function toInt(
  value: string | null | undefined,
  fallback: number,
  opts?: { min?: number; max?: number }
): number {
  const n = parseInt(value ?? '', 10)
  let result = Number.isNaN(n) ? fallback : n
  if (opts?.min !== undefined) result = Math.max(opts.min, result)
  if (opts?.max !== undefined) result = Math.min(opts.max, result)
  return result
}

/**
 * Parse a date query param, returning undefined for missing or invalid input so
 * an unparseable value can't reach Prisma (which throws on Invalid Date).
 */
export function parseDateParam(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}
