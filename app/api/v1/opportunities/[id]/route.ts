import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { fireWebhook } from '@/lib/webhookDelivery'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'opportunities:read')
  if (!auth.ok) return auth.response

  const opp = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: {
      stage: true,
      pipeline: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  if (!opp) return err('NOT_FOUND', 'Opportunity not found', 404)
  return ok(opp)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'opportunities:write')
  if (!auth.ok) return auth.response

  const opp = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: { stage: { select: { name: true } } },
  })
  if (!opp) return err('NOT_FOUND', 'Opportunity not found', 404)

  const body = await req.json().catch(() => ({}))
  const { title, value, stageId, contactId, expectedCloseDate, outcome, notes } = body

  const updated = await prisma.opportunity.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(value !== undefined && { value: parseFloat(value) }),
      ...(stageId !== undefined && { stageId }),
      ...(contactId !== undefined && { contactId }),
      ...(expectedCloseDate !== undefined && { closeDate: new Date(expectedCloseDate) }),
      ...(outcome !== undefined && { outcome }),
      ...(notes !== undefined && { notes }),
    },
    include: { stage: { select: { id: true, name: true } } },
  })

  if (stageId && stageId !== opp.stageId) {
    fireWebhook(auth.userId, 'opportunity.stage_changed', {
      opportunityId: params.id,
      title: updated.title,
      fromStage: opp.stage?.name,
      toStage: updated.stage?.name,
    })
  }

  return ok(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, 'opportunities:write')
  if (!auth.ok) return auth.response

  const opp = await prisma.opportunity.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!opp) return err('NOT_FOUND', 'Opportunity not found', 404)

  await prisma.opportunity.delete({ where: { id: params.id } })
  return ok({ deleted: true })
}
