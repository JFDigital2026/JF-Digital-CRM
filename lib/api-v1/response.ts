import { NextResponse } from 'next/server'

export function ok(
  data: unknown,
  meta?: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) }, { status })
}

export function err(
  code: string,
  message: string,
  status = 400
): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

export function paginate(
  items: unknown[],
  page: number,
  perPage: number,
  total: number
): NextResponse {
  return ok(items, { page, perPage, total, pages: Math.ceil(total / perPage) })
}

export function parsePageParams(req: Request): { page: number; perPage: number; skip: number } {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '20', 10)))
  return { page, perPage, skip: (page - 1) * perPage }
}
