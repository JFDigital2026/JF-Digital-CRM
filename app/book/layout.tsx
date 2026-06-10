export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e8ebee] flex items-center justify-center p-6">
      {children}
    </div>
  )
}
