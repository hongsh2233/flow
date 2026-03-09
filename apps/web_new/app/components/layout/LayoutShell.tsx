"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import { ManagedBannerSection } from "../module/home/ManagedBannerSection";
import { PageBottomBanner } from "../module/home/PageBottomBanner";
import FloatingButtons from "../module/FloatingButtons";

const AUTH_ROUTES = ["/login", "/signup"];
const LAST_LOGIN_KEY = "lastLoginProvider";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAuthPage = AUTH_ROUTES.includes(pathname) || pathname?.startsWith("/login/");

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !session?.user) return;
    const provider = (session as { lastLoginProvider?: string }).lastLoginProvider;
    if (provider) {
      localStorage.setItem(LAST_LOGIN_KEY, provider);
    }
  }, [session]);

  // SSR → CSR 전환 시 깜빡임 방지
  if (!ready) {
    return <div className="wrap" />;
  }

  return (
    <div className="wrap">
      {!isAuthPage && <Header />}
      {!isAuthPage && <ManagedBannerSection />}
      {children}
      {!isAuthPage && <PageBottomBanner />}
      {!isAuthPage && <FloatingButtons />}
      {!isAuthPage && <BottomNavigation />}
    </div>
  );
}
