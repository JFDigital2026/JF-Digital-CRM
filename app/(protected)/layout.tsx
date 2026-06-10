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
  return (
    <AIProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main
            className="flex-1 overflow-auto p-6"
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
