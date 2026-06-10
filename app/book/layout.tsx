export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header */}
      <header className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#0D1B2A] flex items-center justify-center">
            <span className="text-xs font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">Schedule a Meeting</span>
        </div>
      </header>
      <main className="py-10 px-4">
        {children}
      </main>
    </div>
  )
}
