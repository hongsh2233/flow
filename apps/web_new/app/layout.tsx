import type { Metadata, Viewport } from "next";
import Script from "next/script";
import LayoutShell from "./components/layout/LayoutShell";
// import PcMobileAccessGate from "./components/layout/PcMobileAccessGate";
import NextAuthProvider from "./components/providers/NextAuthProvider";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { CapacitorProvider } from "./components/providers/CapacitorProvider";
import type { RootLayoutProps } from "@/lib/types";
import { buildRootMetadata } from "@/lib/config/seo";
import { ADSENSE_CLIENT_ID, ADSENSE_SCRIPT_SRC } from "@/lib/config/adsense";
import "../assets/css/index.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  ...buildRootMetadata(),
  icons: {
    icon: [
      { url: "/images/favicon.svg", type: "image/svg+xml" },
      { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/images/icon-192.png",
  },
  manifest: "/images/manifest.json",
  /** AdSense 사이트 연결·검증 안내 시 사용 (스크립트/ads.txt와 병행, 필수는 아님) */
  other: {
    "google-adsense-account": ADSENSE_CLIENT_ID,
  },
}

export default async function RootLayout({ children }: RootLayoutProps) {
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
        <Script
          src={ADSENSE_SCRIPT_SRC}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <NextAuthProvider>
          <ThemeProvider>
            <CapacitorProvider>
              {/* PC 접속 시 차단(PcMobileAccessGate) — /market 등 데스크톱 허용을 위해 잠시 비활성화
              <PcMobileAccessGate>
                <LayoutShell>{children}</LayoutShell>
              </PcMobileAccessGate>
              */}
              <LayoutShell>{children}</LayoutShell>
            </CapacitorProvider>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
