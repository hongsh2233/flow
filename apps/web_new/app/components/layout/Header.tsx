"use client";

import { BarChart3, Bell, ArrowLeft } from "lucide-react";
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
    const [pointBalance, setPointBalance] = useState<number | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const PAGE_HEADER_TITLES: Record<string, string> = {
        "/faq": "자주하는 질문",
        "/about": "플로우 앱 소개",
        "/settings/profile": "정보 수정",
        "/settings/pin": "간편 비밀번호",
        "/settings/my-stocks": "내 종목 시세",
    };

    const defaultItem = navItems.find((item) => item.id === "home") ?? navItems[0];
    const pageTitle = pathname ? PAGE_HEADER_TITLES[pathname] : undefined;
    const currentItem =
        pageTitle
            ? { ...defaultItem, headerTitle: pageTitle }
            : navItems.find((item) => item.href === pathname) ??
              (pathname?.startsWith("/report") ? navItems.find((item) => item.id === "briefing") : null) ??
              (pathname?.startsWith("/stocks") ? navItems.find((item) => item.id === "stocks") : null) ??
              navItems.find((item) => item.href !== "/" && pathname?.startsWith(item.href)) ??
              defaultItem;

    const isHome = pathname === "/" || pathname === "";
    const nickname = session?.user?.name || "플로우";
    const greetingTitle = isHome
        ? status === "loading"
            ? "안녕하세요."
            : session
                ? `${nickname}님!`
                : "투자자님!"
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
        if (status !== "authenticated") return;
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60_000);
        return () => clearInterval(interval);
    }, [fetchNotifications, status]);

    useEffect(() => {
        if (status !== "authenticated") {
            setPointBalance(null);
            return;
        }
        let cancelled = false;
        fetch("/api/auth/member/info", { cache: "no-store" })
            .then((r) => r.json())
            .then((j) => {
                if (cancelled || typeof j.point_balance !== "number") return;
                setPointBalance(j.point_balance);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [status, session?.user?.email]);

    useEffect(() => {
        const onPoints = (e: Event) => {
            const ce = e as CustomEvent<{ balance?: number }>;
            if (typeof ce.detail?.balance === "number") setPointBalance(ce.detail.balance);
        };
        window.addEventListener("memberPointsUpdated", onPoints);
        return () => window.removeEventListener("memberPointsUpdated", onPoints);
    }, []);

    // Capacitor FCM 포그라운드 알림 수신 시 즉시 갱신
    useEffect(() => {
        const handler = () => fetchNotifications();
        window.addEventListener("fcm-notification", handler);
        return () => window.removeEventListener("fcm-notification", handler);
    }, [fetchNotifications]);

    // 앱/탭이 백그라운드에서 포그라운드로 복귀할 때 즉시 알림 갱신
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                fetchNotifications();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
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

    const handleBackClick = () => router.back();

    /* 서브 페이지: 뒤로가기 + 중앙 타이틀 + 알림 */
    if (!isHome) {
        return (
            <div className={styles.header__wrap}>
                <div className={styles.subTopRow}>
                    <button
                        className={styles.backBtn}
                        onClick={handleBackClick}
                        aria-label="뒤로가기"
                    >
                        <ArrowLeft className={styles.backIcon} aria-hidden />
                    </button>

                    <div className={styles.centerTitle}>
                        <div className={styles.centerTitleIcon}>
                            <BarChart3 className={styles.centerTitleIconSvg} aria-hidden />
                        </div>
                        <span className={styles.centerTitleText}>{currentItem.headerTitle}</span>
                    </div>

                    <div className={styles.rightHeaderCluster}>
                    {status === "authenticated" && pointBalance !== null && (
                        <span className={styles.pointBadge} aria-label="보유 포인트">
                            {pointBalance.toLocaleString()} P
                        </span>
                    )}
                    <div className={styles.bellWrap} ref={panelRef}>
                        <button
                            className={styles.bellBtn}
                            onClick={handleBellClick}
                            aria-label="알림"
                        >
                            <Bell className={styles.bellIcon} aria-hidden />
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
                </div>
            </div>
        );
    }

    /* 메인(홈) 페이지 */
    return (
        <div className={styles.header__wrap}>
            <div className={styles.topRow}>
                {/* 로고 */}
                <div className={styles.logoRow}>
                    <div className={styles.logoIcon}>
                        <BarChart3 className={styles.logoIconSvg} aria-hidden />
                    </div>
                    <span className={styles.logoText}>FLOW</span>
                </div>

                {/* 제목 (알림벨 앞) */}
                <div className={styles.titleRow}>
                    <h2 className={styles.title}>{greetingTitle}</h2>
                    {status === "authenticated" && pointBalance !== null && (
                        <span className={styles.pointBadge} aria-label="보유 포인트">
                            {pointBalance.toLocaleString()} P
                        </span>
                    )}
                </div>

                {/* 알림 아이콘 */}
                <div className={styles.bellWrap} ref={panelRef}>
                    <button
                        className={styles.bellBtn}
                        onClick={handleBellClick}
                        aria-label="알림"
                    >
                        <Bell className={styles.bellIcon} aria-hidden />
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
        </div>
    );
}