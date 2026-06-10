import { requireAuth } from '@/lib/api-v1/auth'
import { ok } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const auth = await requireAuth(req, 'metrics:read')
  if (!auth.ok) return auth.response

  const [
    totalContacts,
    newContactsThisMonth,
    totalRevenue,
    openOpportunities,
    completedTasksThisWeek,
    totalCompanies,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
    prisma.opportunity.count({ where: { outcome: null } }),
    prisma.task.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.company.count(),
  ])

  return ok({
    contacts: {
      total: totalContacts,
      newThisMonth: newContactsThisMonth,
    },
    revenue: {
      total: totalRevenue._sum?.amount ?? 0,
    },
    opportunities: {
      open: openOpportunities,
    },
    tasks: {
      completedThisWeek: completedTasksThisWeek,
    },
    companies: {
      total: totalCompanies,
    },
  })
}
