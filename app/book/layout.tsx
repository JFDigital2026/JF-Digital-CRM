import type { Metadata } from 'next'

// The root layout's metadata is "CRM / CRM Application", which is what link
// previews (LinkedIn, iMessage, Slack) would show for a public booking link.
// Override it for this segment.
// Relative OpenGraph image paths are resolved against metadataBase. Without it
// Next falls back to localhost, which emits an og:image no external crawler can
// fetch, so shared links render with no thumbnail. NEXTAUTH_URL already holds
// the public origin in every environment.
const publicOrigin = process.env.NEXTAUTH_URL ?? 'http://localhost:4000'

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin),
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
