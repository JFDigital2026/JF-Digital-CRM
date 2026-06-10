import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, leadStatus: true },
        orderBy: { firstName: 'asc' },
      },
      opportunities: {
        include: { stage: { select: { name: true, color: true } } },
        orderBy: { createdAt: 'desc' },
      },
      fileAttachments: {
        orderBy: { createdAt: 'desc' },
      },
      activityLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: { select: { contacts: true, opportunities: true, tasks: true } },
    },
  })

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, website, industry, companySize, location, address, city, state, zip, country, timezone, notes,
    lastProjectSummary, lastProjectDate,
  } = body

  const company = await prisma.company.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(website !== undefined && { website }),
      ...(industry !== undefined && { industry }),
      ...(companySize !== undefined && { companySize }),
      ...(location !== undefined && { location }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zip !== undefined && { zip }),
      ...(country !== undefined && { country }),
      ...(timezone !== undefined && { timezone }),
      ...(notes !== undefined && { notes }),
      ...(lastProjectSummary !== undefined && { lastProjectSummary }),
      ...(lastProjectDate !== undefined && { lastProjectDate: lastProjectDate ? new Date(lastProjectDate) : null }),
    },
  })

  await prisma.activityLog.create({
    data: {
      type: 'company.updated',
      description: `Company updated`,
      companyId: params.id,
      userId: session.user.id,
    },
  })

  return NextResponse.json(company)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.company.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
