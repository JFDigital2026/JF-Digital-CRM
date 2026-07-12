import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

export async function GET() {
  // Field definitions are needed to render contact/company forms, so any signed-in
  // user may read them; only managing them requires the settings permission.
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fields = await prisma.customField.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(fields)
}

export async function POST(req: Request) {
  const auth = await requirePermission('settings', 'manageCustomFields')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const field = await prisma.customField.create({
    data: {
      name: body.name,
      key: body.key,
      type: body.type,
      options: body.options || [],
    },
  })
  return NextResponse.json(field, { status: 201 })
}
