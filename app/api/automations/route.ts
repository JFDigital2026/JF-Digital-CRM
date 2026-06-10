import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automations = await prisma.automation.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const withStats = await Promise.all(
    automations.map(async (a) => {
      const [successCount, failureCount] = await Promise.all([
        prisma.automationLog.count({ where: { automationId: a.id, status: 'SUCCESS', executedAt: { gte: thirtyDaysAgo } } }),
        prisma.automationLog.count({ where: { automationId: a.id, status: 'FAILURE', executedAt: { gte: thirtyDaysAgo } } }),
      ])
      const steps = Array.isArray(a.steps) ? a.steps : []
      return { ...a, successCount, failureCount, stepCount: steps.length }
    })
  )

  return NextResponse.json({ automations: withStats })
}
