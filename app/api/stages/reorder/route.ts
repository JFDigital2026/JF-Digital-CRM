import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { stages } = body as { stages: Array<{ id: string; order: number }> }

  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: 'stages must be an array' }, { status: 400 })
  }

  await Promise.all(
    stages.map((s) =>
      prisma.stage.update({
        where: { id: s.id },
        data: { order: s.order },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
