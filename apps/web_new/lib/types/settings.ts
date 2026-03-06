import type { LucideIcon } from "lucide-react";

export interface SettingsItem {
  icon: LucideIcon;
  label: string;
  /** 우측 또는 라벨 아래 표시할 부가 텍스트 */
  subtitle?: string;
  hasSwitch?: boolean;
  hasArrow?: boolean;
  enabled?: boolean;
  href?: string;
  /** 클릭 시 실행할 액션 식별자 (페이지 이동이 아닌 경우) */
  action?: string;
}

export interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}
