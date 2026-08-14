import { Playfair_Display, Inter, Cormorant_Garamond } from 'next/font/google'

// Brand type stack for public-facing pages (booking + reschedule), matching the
// marketing site. The style guide calls for Freight Display; the site licenses
// it through Adobe Fonts and falls back to Playfair Display, so we use the same
// fallback here rather than shipping a second, inconsistent display face.
export const jfDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jf-display',
  display: 'swap',
})

export const jfBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jf-body',
  display: 'swap',
})

// Accent only — one italic word per headline, never body copy.
export const jfAccent = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-jf-accent',
  display: 'swap',
})

export const jfFontVars = `${jfDisplay.variable} ${jfBody.variable} ${jfAccent.variable}`
