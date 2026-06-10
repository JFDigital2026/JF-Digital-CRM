import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId') ?? undefined
  const companyId = searchParams.get('companyId') ?? undefined

  const files = await prisma.fileAttachment.findMany({
    where: {
      ...(contactId ? { contactId } : {}),
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(files)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const file = await prisma.fileAttachment.create({
    data: {
      name: body.name,
      url: body.url,
      size: body.size,
      type: body.type,
      uploadedBy: session.user.id,
      contactId: body.contactId ?? null,
      companyId: body.companyId ?? null,
    },
  })

  return NextResponse.json(file, { status: 201 })
}
