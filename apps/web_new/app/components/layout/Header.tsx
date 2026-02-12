"use client";

import { usePathname } from "next/navigation";
import { navItems } from "@/config/nav";
import styles from "./Header.module.css";

export default function Header() {
    const pathname = usePathname();

    const defaultItem = navItems.find((item) => item.id === "home") ?? navItems[0];
    const currentItem =
        navItems.find((item) => item.href === pathname) ?? defaultItem;

    return (
        <div className={styles.header__wrap}>
        <h2 className={styles.title}>{currentItem.headerTitle}</h2>
        <p className={styles.subtitle}>{currentItem.headerSubtitle}</p>
        </div>
    );
}