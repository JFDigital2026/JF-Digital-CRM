'use client'

import { useState, useEffect, useCallback } from 'react'
import { WidgetGrid, type DashboardStats } from '@/components/dashboard/widget-grid'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // Keep stats null — widgets show empty states
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()

    // Re-fetch when a task is completed from within the grid
    function onTaskCompleted() {
      fetchStats()
    }
    window.addEventListener('task-completed', onTaskCompleted)
    return () => window.removeEventListener('task-completed', onTaskCompleted)
  }, [fetchStats])

  return (
    <div className="p-3 sm:p-6 max-w-[1440px]">
      <WidgetGrid stats={stats} loading={loading} />
    </div>
  )
}
