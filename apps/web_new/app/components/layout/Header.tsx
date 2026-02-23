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
    const grade = (session?.user as { grade?: string } | undefined)?.grade;
    const greetingTitle = isHome
        ? status === "loading"
            ? "안녕하세요."
            : session
                ? `안녕하세요, ${nickname}님!`
                : "안녕하세요."
        : currentItem.headerTitle;

    return (
        <div className={styles.header__wrap}>
            <div className={styles.titleRow}>
                <h2 className={styles.title}>{greetingTitle}</h2>
                {isHome && session && grade === "vip" && (
                    <span className={styles.gradeBadgeVip}>VIP</span>
                )}
                {isHome && session && grade === "family" && (
                    <span className={styles.gradeBadgeFamily}>Family</span>
                )}
            </div>
            <p className={styles.subtitle}>{currentItem.headerSubtitle}</p>
        </div>
    );
}