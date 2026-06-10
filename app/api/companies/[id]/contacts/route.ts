import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  if (search !== null) {
    // Typeahead mode: minimal fields for autocomplete
    const contacts = await prisma.contact.findMany({
      where: {
        companyId: params.id,
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, title: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 20,
    })
    return NextResponse.json(contacts)
  }

  // Full list mode
  const contacts = await prisma.contact.findMany({
    where: { companyId: params.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      title: true,
      role: true,
      leadStatus: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  return NextResponse.json(contacts)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { contactId } = body

  if (!contactId || typeof contactId !== 'string') {
    return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
  }

  // Verify the company exists
  const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // Verify the contact exists
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  // Link contact to company
  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { companyId: params.id },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, title: true, role: true, leadStatus: true },
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      type: 'contact.linked',
      description: `${contact.firstName} ${contact.lastName} linked to company`,
      companyId: params.id,
      contactId: contactId,
      userId: session.user.id,
    },
  })

  return NextResponse.json(updated, { status: 201 })
}
