import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

export async function PATCH(req: Request) {
  const auth = await requirePermission('pipelines', 'managePipelines')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { stages } = body as { stages: Array<{ id: string; order: number }> }

  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: 'stages must be an array' }, { status: 400 })
  }

  // One transaction so a bad row can't leave ordering half-applied.
  await prisma.$transaction(
    stages.map((s) =>
      prisma.stage.update({
        where: { id: s.id },
        data: { order: s.order },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
