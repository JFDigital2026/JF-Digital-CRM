import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { getFullCatalog, getFullCatalogStats } from '@/lib/metrics/registry'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/metrics/types'

/**
 * The metric catalog — definition metadata only, never values. Feeds the picker
 * in Settings → Metrics and the label/unit lookup used when rendering a view.
 * Includes user-created metrics alongside the code-defined ones.
 */
export async function GET() {
  const auth = await requirePermission('metrics', 'view')
  if (!auth.ok) return auth.response

  const [metrics, stats] = await Promise.all([getFullCatalog(), getFullCatalogStats()])

  return NextResponse.json({
    metrics,
    categories: CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
    stats,
  })
}
