export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { processQueue } from '@/lib/queueProcessor'
import { safeEqual } from '@/lib/timing'

// Triggered by an external scheduler. Requires the shared CRON_SECRET so the
// public internet cannot drive the automation queue (DoS / forced sends).
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || !auth || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { processed } = await processQueue()
    return NextResponse.json({ processed })
  } catch (err) {
    console.error('[API] process-queue error:', err)
    return NextResponse.json({ error: 'Queue processing failed' }, { status: 500 })
  }
}
