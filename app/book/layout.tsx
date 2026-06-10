export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e8ebee] flex items-start justify-center">
      {children}
    </div>
  )
}
