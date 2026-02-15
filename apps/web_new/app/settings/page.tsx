"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getImageUrl } from "@/lib/config/api";
import styles from "./Settings.module.css";
import {
  Bell,
  BellRing,
  Moon,
  CalendarCheck,
  KeyRound,
  MessageCircleQuestion,
  ChevronRight,
  User,
  UserX,
  Shield,
  FileText,
  LogIn,
} from "lucide-react";
import { Switch } from "../components/ui/switch";
import { useThemeContext } from "../components/providers/ThemeProvider";
import TermsModal from "../components/ui/TermsModal";
import type { TermsTab } from "../components/ui/TermsModal";
import type { SettingsGroup } from "@/lib/types";

const settingsGroups: SettingsGroup[] = [
  {
    title: "내 정보",
    items: [
      { icon: User, label: "프로필 관리", hasArrow: true, href: "/settings/profile" },
      { icon: UserX, label: "회원 탈퇴", hasArrow: true },
    ],
  },
  {
    title: "알림 설정",
    items: [
      { icon: Bell, label: "푸시 알림", hasSwitch: true, enabled: true },
      { icon: CalendarCheck, label: "일정 알림", hasSwitch: true, enabled: false },
    ],
  },
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", hasSwitch: true, action: "darkmode" },
      { icon: KeyRound, label: "간편 비밀번호 설정", hasArrow: true, href: "/settings/pin" },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: MessageCircleQuestion, label: "자주하는 질문", hasArrow: true, href: "/faq" },
      { icon: BellRing, label: "주린이 알림", hasArrow: true, href: "/board?board=B003" },
      { icon: Shield, label: "개인정보 처리방침", hasArrow: true, action: "privacy" },
      { icon: FileText, label: "이용약관", hasArrow: true, action: "terms" },
    ],
  },
];

// 비로그인 시 보여줄 그룹 (앱 설정에서 간편 비밀번호 제외, 내 정보/알림 설정 숨김)
const guestSettingsGroups: SettingsGroup[] = [
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", hasSwitch: true, action: "darkmode" },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: MessageCircleQuestion, label: "자주하는 질문", hasArrow: true, href: "/faq" },
      { icon: BellRing, label: "주린이 알림", hasArrow: true, href: "/board?board=B003" },
      { icon: Shield, label: "개인정보 처리방침", hasArrow: true, action: "privacy" },
      { icon: FileText, label: "이용약관", hasArrow: true, action: "terms" },
    ],
  },
];

function SettingsScreen() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const { isDark, toggle } = useThemeContext();
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<TermsTab>("privacy");

  const handleItemClick = (href?: string, action?: string) => {
    if (href) {
      router.push(href);
      return;
    }
    if (action === "privacy" || action === "terms") {
      setTermsTab(action);
      setTermsOpen(true);
    }
  };

  const groups = isLoggedIn ? settingsGroups : guestSettingsGroups;

  return (
    <div className={styles.screen}>

      {/* 사용자 프로필 */}
      <div className={styles.profileSection}>
        {isLoggedIn ? (
          <div
            className={`${styles.profileCard} ${styles.clickable}`}
            onClick={() => router.push("/settings/profile")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && router.push("/settings/profile")}
          >
            <div className={styles.profileRow}>
              <div className={styles.profileAvatar}>
                {session?.user?.image ? (
                  <img
                    src={getImageUrl(session.user.image)}
                    alt="프로필"
                    style={{ width: "100%", height: "100%", borderRadius: "9999px", objectFit: "cover" }}
                  />
                ) : (
                  "주"
                )}
              </div>
              <div className={styles.profileText}>
                <h3 className={styles.profileName}>{session?.user?.name || "주린이"}님</h3>
              </div>
              <ChevronRight className={styles.profileArrow} />
            </div>
          </div>
        ) : (
          <div
            className={`${styles.profileCard} ${styles.clickable}`}
            onClick={() => router.push("/login")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && router.push("/login")}
          >
            <div className={styles.profileRow}>
              <div className={styles.profileAvatar}>
                <LogIn size={24} />
              </div>
              <div className={styles.profileText}>
                <h3 className={styles.profileName}>로그인이후 이용 가능합니다.</h3>
                <p className={styles.profileLoginLink}>로그인</p>
              </div>
              <ChevronRight className={styles.profileArrow} />
            </div>
          </div>
        )}
      </div>

      {/* 설정 그룹 */}
      <div className={styles.groups}>
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {group.title}
            </h3>
            <div className={styles.groupCard}>
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                const isClickable = !!(item.href || item.action);
                return (
                  <div
                    key={itemIndex}
                    className={`${styles.itemRow} ${
                      itemIndex !== group.items.length - 1
                        ? styles.itemRowBordered
                        : ""
                    } ${isClickable ? styles.clickable : ""}`}
                    onClick={() => handleItemClick(item.href, item.action)}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={isClickable ? (e) => e.key === "Enter" && handleItemClick(item.href, item.action) : undefined}
                  >
                    <div className={styles.itemLeft}>
                      <div className={styles.itemIconWrap}>
                        <Icon className={styles.itemIcon} />
                      </div>
                      <span className={styles.itemLabel}>{item.label}</span>
                    </div>
                    <div className={styles.actions}>
                      {item.hasSwitch && item.action === "darkmode" && (
                        <Switch checked={isDark} onChange={toggle} />
                      )}
                      {item.hasSwitch && item.action !== "darkmode" && (
                        <Switch defaultChecked={item.enabled} />
                      )}
                      {item.hasArrow && (
                        <ChevronRight className={styles.chevronIcon} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 버전 정보 */}
      <div className={styles.versionSection}>
        <p className={styles.versionText}>주린이 주식 v1.0.0</p>
        <p className={styles.versionSubText}>
          © 2026 Jurini Stock. All rights reserved.
        </p>
      </div>

      {/* 로그아웃/로그인 버튼 */}
      <div className={styles.logoutSection}>
        {isLoggedIn ? (
          <button
            className={styles.logoutButton}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            로그아웃
          </button>
        ) : (
          <button
            className={styles.loginButton}
            onClick={() => router.push("/login")}
          >
            로그인
          </button>
        )}
      </div>

      {/* 약관 팝업 */}
      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        viewOnly
        initialTab={termsTab}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="content__wrap">
      <SettingsScreen />
    </div>
  );
}
