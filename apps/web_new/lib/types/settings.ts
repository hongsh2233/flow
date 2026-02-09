import type { LucideIcon } from "lucide-react";

export interface SettingsItem {
  icon: LucideIcon;
  label: string;
  hasSwitch?: boolean;
  hasArrow?: boolean;
  enabled?: boolean;
}

export interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}
