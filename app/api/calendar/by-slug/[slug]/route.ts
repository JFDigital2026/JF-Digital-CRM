import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — public, no auth required
// Returns CalendarConfig (without sensitive fields) for public booking display
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const config = await prisma.calendarConfig.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      type: true,
      duration: true,
      timezone: true,
      description: true,
      confirmationMessage: true,
      dateRange: true,
      dateRangeUnit: true,
      active: true,
    },
  })

  if (!config || !config.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(config)
}
