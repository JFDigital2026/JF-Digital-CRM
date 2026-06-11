import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { OptionItem } from '../route'

type Ctx = { params: { key: string } }

export async function PUT(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { label: string; items: OptionItem[] } = await req.json()
  if (!body.label || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'label and items required' }, { status: 400 })
  }

  const config = await prisma.systemConfig.upsert({
    where: { userId_key: { userId: session.user.id, key: `optionList_${params.key}` } },
    create: { userId: session.user.id, key: `optionList_${params.key}`, value: body },
    update: { value: body },
  })

  return NextResponse.json(config)
}
