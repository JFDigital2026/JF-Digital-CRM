import { jfFontVars } from '@/lib/public-fonts'
import '../brand-public.css'

// Public-facing surface, same shell as /book so a reschedule link never breaks
// the visual thread from the booking page or the marketing site.
export default function RescheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`jf-public ${jfFontVars} relative min-h-screen`}>
      <div className="jf-public-bg" aria-hidden />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
