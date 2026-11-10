import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Nunito } from 'next/font/google'
import { MotionProvider } from '@/components/motion'
import { CategoryNavigationProvider } from '@/components/category-navigation-state'
import './globals.css'
import { SITE_DESCRIPTION, SITE_TITLE, pageMetadata, siteOrigin } from '@/lib/seo'

// Change these two font loaders to try a different pairing site-wide.
const contentFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-content',
  display: 'swap',
})

const headingFont = Nunito({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

export const metadata: Metadata = {
  ...pageMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: '/' }),
  metadataBase: siteOrigin(),
  title: { default: SITE_TITLE, template: '%s | Pixinium' },
  alternates: undefined,
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
  icons: {
    icon: { url: '/brand/pixinium-crystal.svg', type: 'image/svg+xml' },
    apple: '/brand/pixinium-apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${contentFont.variable} ${headingFont.variable}`}>
      <body className="antialiased">
        <MotionProvider><CategoryNavigationProvider>{children}</CategoryNavigationProvider></MotionProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
