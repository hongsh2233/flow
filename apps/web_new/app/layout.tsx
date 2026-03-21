import type { Metadata, Viewport } from "next";
import LayoutShell from "./components/layout/LayoutShell";
import NextAuthProvider from "./components/providers/NextAuthProvider";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { CapacitorProvider } from "./components/providers/CapacitorProvider";
import type { RootLayoutProps } from "@/lib/types";
import "../assets/css/index.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: '플로우',
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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-52KM4V3R');` }} />
        {/* End Google Tag Manager */}
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-52KM4V3R" height="0" width="0" style={{ display: 'none', visibility: 'hidden' }}></iframe></noscript>
        {/* End Google Tag Manager (noscript) */}
        <NextAuthProvider>
          <ThemeProvider>
            <CapacitorProvider>
              <LayoutShell>{children}</LayoutShell>
            </CapacitorProvider>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
