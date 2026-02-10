"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";

const AUTH_ROUTES = ["/login", "/signup"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  return (
    <div className="wrap">
      {!isAuthPage && <Header />}
      {children}
      {!isAuthPage && <BottomNavigation />}
    </div>
  );
}
