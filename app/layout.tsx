import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import PWA from '@/components/PWA'

export const metadata: Metadata = {
  title: 'IronPulse — Your AI Gym Coach',
  description: 'AI-powered workout planner, exercise logger, and nutrition tracker',
  manifest: '/manifest.json',
  applicationName: 'IronPulse',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'IronPulse', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#080810',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PWA />
      </body>
    </html>
  )
}
