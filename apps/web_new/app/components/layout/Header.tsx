"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { navItems } from "@/config/nav";
import styles from "./Header.module.css";

interface NotificationItem {
    id: number;
    type: string;
    title: string;
    message: string | null;
    link_url: string | null;
    is_read: boolean;
    created_at: string | null;
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "방금";
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}일 전`;
    return new Date(dateStr).toLocaleDateString("ko-KR");
}

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [panelOpen, setPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

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

    const fetchNotifications = useCallback(async () => {
        if (status !== "authenticated") return;
        try {
            const res = await fetch("/api/notifications", { cache: "no-store" });
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data ?? []);
                setUnreadCount(data.unread_count ?? 0);
            }
        } catch { /* ignore */ }
    }, [status]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60_000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        };
        if (panelOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [panelOpen]);

    const handleBellClick = () => {
        if (status !== "authenticated") {
            router.push("/login");
            return;
        }
        setPanelOpen((prev) => !prev);
    };

    const handleNotificationClick = async (noti: NotificationItem) => {
        if (!noti.is_read) {
            try {
                await fetch("/api/notifications/read", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notification_ids: [noti.id] }),
                });
                setNotifications((prev) =>
                    prev.map((n) => (n.id === noti.id ? { ...n, is_read: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            } catch { /* ignore */ }
        }
        setPanelOpen(false);
        if (noti.link_url) router.push(noti.link_url);
    };

    const handleReadAll = async () => {
        try {
            await fetch("/api/notifications/read-all", { method: "POST" });
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { /* ignore */ }
    };

    return (
        <div className={styles.header__wrap}>
            <div className={styles.topRow}>
                <div className={styles.titleRow}>
                    <h2 className={styles.title}>{greetingTitle}</h2>
                    {isHome && session && grade === "vip" && (
                        <span className={styles.gradeBadgeVip}>VIP</span>
                    )}
                    {isHome && session && grade === "family" && (
                        <span className={styles.gradeBadgeFamily}>Family</span>
                    )}
                </div>

                <div className={styles.bellWrap} ref={panelRef}>
                    <button
                        className={styles.bellBtn}
                        onClick={handleBellClick}
                        aria-label="알림"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {unreadCount > 0 && (
                            <span className={styles.badge}>
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {panelOpen && (
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <span className={styles.panelTitle}>알림</span>
                                {unreadCount > 0 && (
                                    <button className={styles.readAllBtn} onClick={handleReadAll}>
                                        모두 읽음
                                    </button>
                                )}
                            </div>
                            <div className={styles.panelBody}>
                                {notifications.length === 0 ? (
                                    <div className={styles.emptyNoti}>알림이 없습니다.</div>
                                ) : (
                                    notifications.map((noti) => (
                                        <button
                                            key={noti.id}
                                            className={`${styles.notiItem} ${!noti.is_read ? styles.notiUnread : ""}`}
                                            onClick={() => handleNotificationClick(noti)}
                                        >
                                            <div className={styles.notiDot}>
                                                {!noti.is_read && <span className={styles.dot} />}
                                            </div>
                                            <div className={styles.notiContent}>
                                                <span className={styles.notiTitle}>{noti.title}</span>
                                                <span className={styles.notiTime}>{timeAgo(noti.created_at)}</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <p className={styles.subtitle}>{currentItem.headerSubtitle}</p>
        </div>
    );
}
