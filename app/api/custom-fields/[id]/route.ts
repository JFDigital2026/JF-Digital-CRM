import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permissions'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageCustomFields')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const field = await prisma.customField.update({
    where: { id: params.id },
    data: {
      name: body.name,
      options: body.options ?? [],
    },
  })
  return NextResponse.json(field)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission('settings', 'manageCustomFields')
  if (!auth.ok) return auth.response

  await prisma.customField.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
