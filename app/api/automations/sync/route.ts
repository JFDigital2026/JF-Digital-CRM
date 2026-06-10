import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { scanAndSyncAll } from '@/lib/automationSync'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { synced, errors } = await scanAndSyncAll()
    return NextResponse.json({ synced, errors, syncedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[API] sync failed:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
