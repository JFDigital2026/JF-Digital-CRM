import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { triggerAutomation } from '@/lib/automation-engine'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      customFieldValues: { include: { customField: true } },
    },
  })

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customFields, newCompanyName, ...updates } = body

  const prev = await prisma.contact.findUnique({ where: { id: params.id } })
  if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let companyId = updates.companyId
  if (newCompanyName?.trim()) {
    const co = await prisma.company.create({ data: { name: newCompanyName.trim() } })
    companyId = co.id
  }

  const clean = Object.fromEntries(
    Object.entries({ ...updates, ...(companyId !== undefined ? { companyId } : {}) }).filter(
      ([, v]) => v !== undefined
    )
  )

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: clean,
    include: { company: { select: { id: true, name: true } } },
  })

  if (customFields && typeof customFields === 'object') {
    await Promise.all(
      Object.entries(customFields as Record<string, string>).map(([customFieldId, value]) =>
        value
          ? prisma.customFieldValue.upsert({
              where: { customFieldId_contactId: { customFieldId, contactId: params.id } },
              create: { customFieldId, contactId: params.id, value },
              update: { value },
            })
          : prisma.customFieldValue.deleteMany({ where: { customFieldId, contactId: params.id } })
      )
    )
  }

  const statusChanged = updates.leadStatus && updates.leadStatus !== prev.leadStatus
  await prisma.activityLog.create({
    data: {
      contactId: params.id,
      userId: session.user.id,
      type: statusChanged ? 'status.changed' : 'contact.updated',
      description: statusChanged
        ? `Lead status changed from ${prev.leadStatus} to ${updates.leadStatus}`
        : `Contact updated`,
      metadata: statusChanged
        ? { from: prev.leadStatus, to: updates.leadStatus }
        : { fields: Object.keys(updates) },
    },
  })

  // Fire TAG_ADDED automation for any new tags
  if (Array.isArray(updates.tags)) {
    const prevTags = prev.tags ?? []
    const newTags = (updates.tags as string[]).filter((t) => !prevTags.includes(t))
    for (const tag of newTags) {
      triggerAutomation('TAG_ADDED', params.id, { tag }).catch(() => {})
    }
  }

  return NextResponse.json(contact)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contact = await prisma.contact.findUnique({ where: { id: params.id } })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.contact.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
