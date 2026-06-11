'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { PageTransition } from '@/components/page-transition'
import { AIProvider } from '@/components/ai/ai-provider'
import { AIFloatingButton } from '@/components/ai/floating-button'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <AIProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
          <main
            className="flex-1 overflow-auto p-3 sm:p-6 pb-safe"
            style={{
              background: 'linear-gradient(145deg, #dde3ec 0%, #e8ecf1 40%, #dfe5ed 100%)',
              backgroundAttachment: 'fixed',
            }}
          >
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <AIFloatingButton />
    </AIProvider>
  )
}
