import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automation = await prisma.automation.findUnique({ where: { id: params.id } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 25

  const [logs, total] = await Promise.all([
    prisma.automationLog.findMany({
      where: { automationId: params.id },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { executedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.automationLog.count({ where: { automationId: params.id } }),
  ])

  return NextResponse.json({ logs, total, page, pageSize })
}
