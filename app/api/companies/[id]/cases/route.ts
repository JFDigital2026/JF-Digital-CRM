import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cases = await prisma.appointmentCase.findMany({
    where: { companyId: params.id },
    include: { attendees: true },
    orderBy: { appointmentDate: 'desc' },
  })

  return NextResponse.json(cases)
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, appointmentDate, fathomLink, notes, attendees = [] } = body

  if (!title || !appointmentDate) {
    return NextResponse.json({ error: 'title and appointmentDate are required' }, { status: 400 })
  }

  const newCase = await prisma.appointmentCase.create({
    data: {
      companyId: params.id,
      title,
      appointmentDate: new Date(appointmentDate),
      fathomLink: fathomLink || null,
      notes: notes || null,
      attendees: {
        create: (attendees as { name: string; role?: string }[])
          .filter((a) => a.name?.trim())
          .map((a) => ({ name: a.name.trim(), role: a.role?.trim() || null })),
      },
    },
    include: { attendees: true },
  })

  return NextResponse.json(newCase, { status: 201 })
}
