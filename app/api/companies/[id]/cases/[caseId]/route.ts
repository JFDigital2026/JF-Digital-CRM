import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; caseId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the case belongs to the company
  const existing = await prisma.appointmentCase.findFirst({
    where: { id: params.caseId, companyId: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.appointmentCase.delete({ where: { id: params.caseId } })

  return NextResponse.json({ ok: true })
}
