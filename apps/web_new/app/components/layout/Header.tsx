"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { navItems } from "@/config/nav";
import styles from "./Header.module.css";

export default function Header() {
    const pathname = usePathname();
    const { data: session, status } = useSession();

    const defaultItem = navItems.find((item) => item.id === "home") ?? navItems[0];
    const currentItem =
        navItems.find((item) => item.href === pathname) ?? defaultItem;

    const isHome = pathname === "/" || pathname === "";
    const nickname = session?.user?.name || "주린이";
    const greetingTitle = isHome
        ? status === "loading"
        ./app/components/layout/LayoutShell.tsx:32:45
        Type error: Conversion of type 'Session' to type '{ lastLoginProvider: string; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
        
          Property 'lastLoginProvider' is missing in type 'Session' but required in type '{ lastLoginProvider: string; }'.
          30 |   useEffect(() => {
          31 |     if (typeof window !== "undefined" && session?.user && (session as { lastLoginProvider?: string }).lastLoginProvider) {
        > 32 |       localStorage.setItem(LAST_LOGIN_KEY, (session as { lastLoginProvider: string }).lastLoginProvider);
             |                                             ^
          33 |     }
          34 |   }, [session]);
          35 |           ? "안녕하세요."
            : session
              ? `안녕하세요, ${nickname}님!`
              : "안녕하세요."
        : currentItem.headerTitle;

    return (
        <div className={styles.header__wrap}>
            <h2 className={styles.title}>{greetingTitle}</h2>
            <p className={styles.subtitle}>{currentItem.headerSubtitle}</p>
        </div>
    );
}