import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashApiKey } from '@/lib/api-v1/auth'
import { randomBytes } from 'crypto'
import { requirePermission } from '@/lib/permissions'

const FULL_SCOPES = [
  'contacts:read', 'contacts:write',
  'companies:read', 'companies:write',
  'opportunities:read', 'opportunities:write',
  'tasks:read', 'tasks:write',
  'calendar:read', 'calendar:write',
  'messages:read', 'messages:write',
  'products:read', 'automations:trigger', 'metrics:read',
  // Write scope for the outbound stats ingest. Create a dedicated key for the
  // Lead Gen push holding only this — separate from the lead-import key, so a
  // leak of one can be revoked without breaking the other.
  'metrics:write',
]

const READ_ONLY_SCOPES = [
  'contacts:read', 'companies:read', 'opportunities:read',
  'tasks:read', 'calendar:read', 'messages:read',
  'products:read', 'metrics:read',
]

export async function GET() {
  const auth = await requirePermission('settings', 'manageApi')
  if (!auth.ok) return auth.response

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      scopes: true,
      active: true,
      lastUsed: true,
      createdAt: true,
      _count: { select: { logs: true } },
    },
  })

  return NextResponse.json({ keys })
}

export async function POST(req: Request) {
  const auth = await requirePermission('settings', 'manageApi')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const name = body.name ?? 'API Key'

  // Least privilege by default. Explicit scopes are filtered to the known set
  // (blocks '*' or arbitrary values); full access is opt-in via fullAccess.
  let scopes: string[]
  if (Array.isArray(body.scopes) && body.scopes.length > 0) {
    scopes = body.scopes.filter((s: unknown) => typeof s === 'string' && FULL_SCOPES.includes(s))
    if (scopes.length === 0) scopes = READ_ONLY_SCOPES
  } else if (body.fullAccess === true) {
    scopes = FULL_SCOPES
  } else {
    scopes = READ_ONLY_SCOPES
  }

  const rawKey = 'crm_' + randomBytes(24).toString('hex')
  const hashedKey = hashApiKey(rawKey)

  const apiKey = await prisma.apiKey.create({
    data: { name, hashedKey, userId: auth.session.user.id, scopes },
  })

  return NextResponse.json({
    key: rawKey,
    id: apiKey.id,
    name: apiKey.name,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
  }, { status: 201 })
}
