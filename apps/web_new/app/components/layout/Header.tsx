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
    const greetingTitle = isHome
        ? status === "loading"
            ? "안녕하세요."
            : session?.user?.name
              ? `안녕하세요. ${session.user.name}`
              : "안녕하세요."
        : currentItem.headerTitle;

    return (
        <div className={styles.header__wrap}>
            <h2 className={styles.title}>{greetingTitle}</h2>
            <p className={styles.subtitle}>{currentItem.headerSubtitle}</p>
        </div>
    );
}