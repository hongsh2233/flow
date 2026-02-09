// @ts-nocheck
import type { Metadata } from 'next'
import Header from './components/layout/Header'
import BottomNavigation from './components/layout/BottomNavigation'
import NextAuthProvider from './components/providers/NextAuthProvider'
import '../assets/css/index.css'

export const metadata: Metadata = {
  title: '주리니',
  description: '',
  icons: {
    icon: [
      { url: '/images/favicon.svg', type: 'image/svg+xml' },
      { url: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/images/icon-192.png',
  },
  manifest: '/images/manifest.json',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>
        <NextAuthProvider>
          <div className="wrap">
            <Header />
            {children}
            <BottomNavigation />
          </div>
        </NextAuthProvider>
      </body>
    </html>
  )
}
