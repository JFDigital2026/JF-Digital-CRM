import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type OptionItem = { value: string; label: string; color?: string }

// Default option lists seeded on first access
const DEFAULTS: Record<string, { label: string; items: OptionItem[] }> = {
  leadStatus: {
    label: 'Lead Status',
    items: [
      { value: 'NEW',            label: 'New',            color: '#2563eb' },
      { value: 'TRIAL',          label: 'Trial',          color: '#7c3aed' },
      { value: 'ACTIVE',         label: 'Active',         color: '#059669' },
      { value: 'LOST',           label: 'Lost',           color: '#6b7280' },
      { value: 'CANNOT_CONTACT', label: 'Cannot Contact', color: '#dc2626' },
      { value: 'CLOSED',         label: 'Closed',         color: '#d97706' },
    ],
  },
  source: {
    label: 'Lead Source',
    items: [
      { value: 'Website',      label: 'Website' },
      { value: 'Referral',     label: 'Referral' },
      { value: 'Cold Outreach',label: 'Cold Outreach' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Event',        label: 'Event' },
      { value: 'Other',        label: 'Other' },
    ],
  },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = await prisma.systemConfig.findMany({
    where: { userId: session.user.id, key: { startsWith: 'optionList_' } },
  })

  const result: Record<string, { label: string; items: OptionItem[] }> = {}

  for (const [key, def] of Object.entries(DEFAULTS)) {
    const stored = configs.find((c) => c.key === `optionList_${key}`)
    result[key] = stored ? (stored.value as { label: string; items: OptionItem[] }) : def
  }

  return NextResponse.json(result)
}
