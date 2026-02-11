"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import PinLockScreen from "../ui/PinLockScreen";
import { isPinSet } from "@/lib/utils/pin";

const AUTH_ROUTES = ["/login", "/signup"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  const [pinLocked, setPinLocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 localStorage 확인
    if (!isAuthPage && isPinSet()) {
      setPinLocked(true);
    }
    setReady(true);
  }, [isAuthPage]);

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
