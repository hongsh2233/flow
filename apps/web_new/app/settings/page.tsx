import styles from "./Settings.module.css";
import {
  Bell, 
  Moon, 
  HelpCircle, 
  Lock, 
  Mail, 
  ChevronRight,
  User,
  Shield,
  FileText
} from "lucide-react";
import { Switch } from "../components/ui/switch";

const settingsGroups = [
  {
    title: "내 정보",
    items: [
      { icon: User, label: "프로필 관리", hasArrow: true },
      { icon: Mail, label: "이메일 변경", hasArrow: true },
    ],
  },
  {
    title: "알림 설정",
    items: [
      { icon: Bell, label: "푸시 알림", hasSwitch: true, enabled: true },
      { icon: Bell, label: "가격 알림", hasSwitch: true, enabled: true },
      { icon: Bell, label: "뉴스 알림", hasSwitch: true, enabled: false },
    ],
  },
  {
    title: "앱 설정",
    items: [
      { icon: Moon, label: "다크 모드", hasSwitch: true, enabled: false },
      { icon: Lock, label: "보안 설정", hasArrow: true },
    ],
  },
  {
    title: "지원",
    items: [
      { icon: HelpCircle, label: "도움말", hasArrow: true },
      { icon: Shield, label: "개인정보 처리방침", hasArrow: true },
      { icon: FileText, label: "이용약관", hasArrow: true },
    ],
  },
];

function SettingsScreen() {
  return (
    <div className={styles.screen}>

      {/* 사용자 프로필 */}
      <div className={styles.profileSection}>
        <div className={styles.profileCard}>
          <div className={styles.profileRow}>
            <div className={styles.profileAvatar}>
              주
            </div>
            <div className={styles.profileText}>
              <h3 className={styles.profileName}>주린이님</h3>
              <p className={styles.profileRole}>초보 투자자</p>
            </div>
            <ChevronRight className={styles.profileArrow} />
          </div>
        </div>
      </div>

      {/* 설정 그룹 */}
      <div className={styles.groups}>
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {group.title}
            </h3>
            <div className={styles.groupCard}>
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div
                    key={itemIndex}
                    className={`${styles.itemRow} ${
                      itemIndex !== group.items.length - 1
                        ? styles.itemRowBordered
                        : ""
                    }`}
                  >
                    <div className={styles.itemLeft}>
                      <div className={styles.itemIconWrap}>
                        <Icon className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className={styles.itemLabel}>{item.label}</span>
                    </div>
                    <div className={styles.actions}>
                      {item.hasSwitch && (
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

      {/* 로그아웃 버튼 */}
      <div className={styles.logoutSection}>
        <button className={styles.logoutButton}>
          로그아웃
        </button>
      </div>

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