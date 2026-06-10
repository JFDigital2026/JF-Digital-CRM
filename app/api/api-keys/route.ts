import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashApiKey } from '@/lib/api-v1/auth'
import { randomBytes } from 'crypto'

const FULL_SCOPES = [
  'contacts:read', 'contacts:write',
  'companies:read', 'companies:write',
  'opportunities:read', 'opportunities:write',
  'tasks:read', 'tasks:write',
  'calendar:read', 'calendar:write',
  'messages:read', 'messages:write',
  'products:read', 'automations:trigger', 'metrics:read',
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = body.name ?? 'API Key'
  const scopes = Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : FULL_SCOPES

  const rawKey = 'crm_' + randomBytes(24).toString('hex')
  const hashedKey = hashApiKey(rawKey)

  const apiKey = await prisma.apiKey.create({
    data: { name, hashedKey, userId: session.user.id, scopes },
  })

  return NextResponse.json({
    key: rawKey,
    id: apiKey.id,
    name: apiKey.name,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
  }, { status: 201 })
}
