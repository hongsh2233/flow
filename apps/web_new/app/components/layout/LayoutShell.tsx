"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import PinLockScreen from "../ui/PinLockScreen";
import { isPinSet } from "@/lib/utils/pin";

const AUTH_ROUTES = ["/login", "/signup"];
const LAST_LOGIN_KEY = "lastLoginProvider";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAuthPage = AUTH_ROUTES.includes(pathname) || pathname?.startsWith("/login/");

  const [pinLocked, setPinLocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 localStorage 확인
    if (!isAuthPage && isPinSet()) {
      setPinLocked(true);
    }
    setReady(true);
  }, [isAuthPage]);

  useEffect(() => {
    if (typeof window !== "undefined" && session?.user && (session as { lastLoginProvider?: string }).lastLoginProvider) {
      localStorage.setItem(LAST_LOGIN_KEY, (session as { lastLoginProvider: string }).lastLoginProvider);
    }
  }, [session]);

  // SSR → CSR 전환 시 깜빡임 방지
  if (!ready) {
    return <div className="wrap" />;
  }

  if (pinLocked) {
    return <PinLockScreen onUnlock={() => setPinLocked(false)} />;
  }

  return (
    <div className="wrap">
      {!isAuthPage && <Header />}
      {children}
      {!isAuthPage && <BottomNavigation />}
    </div>
  );
}
