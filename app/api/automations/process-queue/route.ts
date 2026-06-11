export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { processQueue } from '@/lib/queueProcessor'

export async function GET() {
  try {
    const { processed } = await processQueue()
    return NextResponse.json({ processed })
  } catch (err) {
    console.error('[API] process-queue error:', err)
    return NextResponse.json({ error: 'Queue processing failed' }, { status: 500 })
  }
}
