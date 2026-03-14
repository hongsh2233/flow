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
      <body>
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
