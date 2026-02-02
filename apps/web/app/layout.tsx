import type { Metadata } from 'next'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import NextAuthProvider from './components/providers/NextAuthProvider'
import '../assets/css/globals.css'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

export const metadata: Metadata = {
  title: '주리니',
  description: '',
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
            <BottomNav />
          </div>
        </NextAuthProvider>
      </body>
    </html>
  )
}
