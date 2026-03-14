"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  useNotificationSettings,
  isJurinAppWebView,
  requestAndroidNotificationPermission,
} from "@/lib/hooks/useNotificationSettings";
import { getImageUrl } from "@/lib/config/api";
import { withdrawMember } from "@/lib/services/authService";
import styles from "./Settings.module.css";
import {
  Bell,
  BellRing,
  Moon,
  // CalendarCheck, // 일정 알림 (주석 처리)
  // KeyRound,
  MessageCircleQuestion,
  ChevronRight,
  User,
  UserX,
  Shield,
  FileText,
  LogIn,
  Info,
} from "lucide-react";
import { Switch } from "../components/ui/switch";
import { StockTermBox } from "../components/module/stock-term-box";
import { useThemeContext } from "../components/providers/ThemeProvider";
import TermsModal from "../components/ui/TermsModal";
import type { TermsTab } from "../components/ui/TermsModal";
import type { SettingsGroup } from "@/lib/types";

const JUBTI_LABELS: Record<string, string> = {
  A: "불나방 파이터 (공격형)",
  D: "철벽 거북이 (방어형)",
  N: "돋보기 탐정 (분석형)",
  I: "촉 좋은 야생마 (직관형)",
};

const settingsGroups: SettingsGroup[] = [
  {
    title: "내 정보",
    items: [
      { icon: User, label: "프로필 관리", hasArrow: true, href: "/settings/profile" },
      { icon: UserX, label: "회원 탈퇴", hasArrow: true, action: "withdraw" },
    ],
  },
  {
    title: "알림 / 앱 설정",
    items: [
      { icon: Bell, label: "푸시 알림", hasSwitch: true, action: "push", enabled: true },
      // { icon: CalendarCheck, label: "일정 알림", hasSwitch: true, action: "scheduleAlarm", enabled: false },
      { icon: Moon, label: "다크 모드", hasSwitch: true, action: "darkmode" },
      // { icon: KeyRound, label: "간편 비밀번호 설정", hasArrow: true, href: "/settings/pin" },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: MessageCircleQuestion, label: "자주하는 질문", hasArrow: true, href: "/faq" },
      { icon: BellRing, label: "플로우 알림", hasArrow: true, href: "/board?board=B003" },
      { icon: Shield, label: "개인정보 처리방침", hasArrow: true, action: "privacy" },
      { icon: FileText, label: "이용약관", hasArrow: true, action: "terms" },
      { icon: Info, label: "플로우 앱 소개", hasArrow: true, href: "/about" },
    ],
  },
];

// 비로그인 시 보여줄 그룹 (내 정보 숨김, 알림은 표시하되 로그인 후 이용)
const guestSettingsGroups: SettingsGroup[] = [
  {
    title: "알림 / 앱 설정",
    items: [
      { icon: Bell, label: "푸시 알림", hasSwitch: true, action: "push", enabled: false },
      // { icon: CalendarCheck, label: "일정 알림", hasSwitch: true, action: "scheduleAlarm", enabled: false },
      { icon: Moon, label: "다크 모드", hasSwitch: true, action: "darkmode" },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: MessageCircleQuestion, label: "자주하는 질문", hasArrow: true, href: "/faq" },
      { icon: BellRing, label: "플로우 알림", hasArrow: true, href: "/board?board=B003" },
      { icon: Shield, label: "개인정보 처리방침", hasArrow: true, action: "privacy" },
      { icon: FileText, label: "이용약관", hasArrow: true, action: "terms" },
      { icon: Info, label: "플로우 앱 소개", hasArrow: true, href: "/about" },
    ],
  },
];

function SettingsScreen() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const { isDark, toggle } = useThemeContext();
  const {
    scheduleAlarmEnabled,
    pushEnabled,
    setScheduleAlarmEnabled,
    setPushEnabled,
  } = useNotificationSettings();
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<TermsTab>("privacy");
  const [jubtiType, setJubtiType] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/auth/member/jubti")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.jubti_type) {
          setJubtiType(data.jubti_type);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const handleItemClick = async (href?: string, action?: string) => {
    if (href) {
      router.push(href);
      return;
    }
    if (action === "privacy" || action === "terms") {
      setTermsTab(action);
      setTermsOpen(true);
      return;
    }
    if (action === "withdraw") {
      if (!session?.user?.email) {
        alert("로그인이 필요합니다.");
        return;
      }
      const confirmed = window.confirm(
        "정말 회원탈퇴를 하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 삭제됩니다."
      );
      if (!confirmed) return;
      try {
        const result = await withdrawMember(session.user.email);
        if (result.success) {
          alert("회원 탈퇴가 완료되었습니다.");
          await signOut({ callbackUrl: "/" });
          router.push("/");
        } else {
          alert(result.message ?? "회원 탈퇴에 실패했습니다.");
        }
      } catch (error) {
        console.error("회원 탈퇴 오류:", error);
        alert("회원 탈퇴 중 오류가 발생했습니다.");
      }
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
                <div className={styles.profileNameRow}>
                  <h3 className={styles.profileName}>
                  {session?.user?.name || "플로우"}
                  {jubtiType ? `(${JUBTI_LABELS[jubtiType] ?? jubtiType})` : "(주비티야)"}
                </h3>
                  {(session?.user as { grade?: string })?.grade === "vip" && (
                    <span className={styles.gradeBadgeVip}>V</span>
                  )}
                  {(session?.user as { grade?: string })?.grade === "family" && (
                    <span className={styles.gradeBadgeFamily}>F</span>
                  )}
                </div>
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
                      <div className={styles.itemLabelWrap}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.subtitle && (
                          <span className={styles.itemSubtitle}>{item.subtitle}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      {item.hasSwitch && item.action === "darkmode" && (
                        <Switch checked={isDark} onChange={toggle} />
                      )}
                      {item.hasSwitch && item.action === "scheduleAlarm" && (
                        <Switch
                          checked={isLoggedIn ? scheduleAlarmEnabled : false}
                          onChange={(checked) => {
                            if (!isLoggedIn) {
                              alert("로그인 이후 이용할 수 있습니다.");
                              return;
                            }
                            setScheduleAlarmEnabled(checked);
                          }}
                        />
                      )}
                      {item.hasSwitch && item.action === "push" && (
                        <Switch
                          checked={isLoggedIn ? pushEnabled : false}
                          onChange={async (checked) => {
                            if (!isLoggedIn) {
                              alert("로그인 이후 이용할 수 있습니다.");
                              return;
                            }
                            if (checked && isJurinAppWebView()) {
                              // JurinApp 네이티브 환경: Android 알림 권한 먼저 요청
                              const granted = await requestAndroidNotificationPermission();
                              if (!granted) {
                                alert(
                                  "알림 권한이 없어 푸시 알림을 켤 수 없습니다.\n" +
                                  "기기 설정 > 앱 > 플로우 > 알림에서 허용해 주세요."
                                );
                                return;
                              }
                            }
                            setPushEnabled(checked);
                          }}
                        />
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
        <p className={styles.versionText}>플로우 주식 v1.0.0</p>
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
      <StockTermBox wrapperStyle={{ marginTop: "1.5rem" }} />
    </div>
  );
}
