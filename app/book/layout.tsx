import type { Metadata } from 'next'

// The root layout's metadata is "CRM / CRM Application", which is what link
// previews (LinkedIn, iMessage, Slack) would show for a public booking link.
// Override it for this segment.
export const metadata: Metadata = {
  title: 'Book a call | JF Digital',
  description:
    'Book a diagnostic call with JF Digital. Custom AI systems for personal injury law firms.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Book a call | JF Digital',
    description:
      'Book a diagnostic call with JF Digital. Custom AI systems for personal injury law firms.',
    type: 'website',
    images: ['/jf-logo-full.png'],
  },
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e8ebee]">
      {children}
    </div>
  )
}
