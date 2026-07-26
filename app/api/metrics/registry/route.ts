import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { getCatalog, getCatalogStats } from '@/lib/metrics/registry'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/metrics/types'

/**
 * The metric catalog — definition metadata only, never values. Feeds the picker
 * in Settings → Metrics and the label/unit lookup used when rendering a view.
 */
export async function GET() {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  return NextResponse.json({
    metrics: getCatalog(),
    categories: CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
    stats: getCatalogStats(),
  })
}
