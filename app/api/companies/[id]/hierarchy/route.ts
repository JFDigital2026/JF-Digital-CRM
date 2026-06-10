import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { hierarchyJson } = body as { hierarchyJson: Record<string, string | null> }

  if (!hierarchyJson || typeof hierarchyJson !== 'object' || Array.isArray(hierarchyJson)) {
    return NextResponse.json({ error: 'hierarchyJson must be an object mapping contactId -> managerId' }, { status: 400 })
  }

  // Verify company exists
  const existing = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const company = await prisma.company.update({
    where: { id: params.id },
    data: { hierarchyJson },
    select: { id: true, hierarchyJson: true },
  })

  await prisma.activityLog.create({
    data: {
      type: 'company.hierarchy_updated',
      description: 'Org chart updated',
      companyId: params.id,
      userId: session.user.id,
    },
  })

  return NextResponse.json(company)
}
