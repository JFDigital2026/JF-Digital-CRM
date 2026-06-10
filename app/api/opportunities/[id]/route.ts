import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { triggerAutomation } from '@/lib/automation-engine'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, title: true } },
      company: { select: { id: true, name: true, website: true } },
      stage: { select: { id: true, name: true, color: true, order: true } },
      pipeline: { select: { id: true, name: true } },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  })

  if (!opportunity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(opportunity)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, value, probability, closeDate, stageId, contactId, companyId, notes, outcome, wonAmount, outcomeReason, assignedTo } = body

  const prev = await prisma.opportunity.findUnique({ where: { id: params.id } })

  const opportunity = await prisma.opportunity.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(value !== undefined && { value: value ? parseFloat(value) : null }),
      ...(probability !== undefined && { probability: probability ? parseFloat(probability) : null }),
      ...(closeDate !== undefined && { closeDate: closeDate ? new Date(closeDate) : null }),
      ...(stageId !== undefined && { stageId }),
      ...(contactId !== undefined && { contactId: contactId || null }),
      ...(companyId !== undefined && { companyId: companyId || null }),
      ...(notes !== undefined && { notes }),
      ...(outcome !== undefined && { outcome }),
      ...(wonAmount !== undefined && { wonAmount: wonAmount ? parseFloat(wonAmount) : null }),
      ...(outcomeReason !== undefined && { outcomeReason }),
      ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, color: true } },
    },
  })

  if (stageId && prev?.stageId !== stageId) {
    const newStage = await prisma.stage.findUnique({ where: { id: stageId }, select: { name: true } })
    await prisma.activityLog.create({
      data: {
        type: 'opportunity.stage_changed',
        description: `Deal moved to "${newStage?.name ?? stageId}"`,
        contactId: opportunity.contactId,
        companyId: opportunity.companyId,
        userId: session.user.id,
      },
    })
    if (opportunity.contactId) {
      triggerAutomation('OPPORTUNITY_STAGE_CHANGED', opportunity.contactId, { stageId, stageName: newStage?.name }).catch(() => {})
    }
  }

  return NextResponse.json(opportunity)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.opportunity.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
