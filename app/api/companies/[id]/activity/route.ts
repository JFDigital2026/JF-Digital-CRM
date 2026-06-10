import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch logs directly on this company, OR on contacts that belong to this company
  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { companyId: params.id },
        { contact: { companyId: params.id } },
      ],
    },
    select: {
      id: true,
      type: true,
      description: true,
      createdAt: true,
      metadata: true,
      contactId: true,
      opportunityId: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(logs)
}
