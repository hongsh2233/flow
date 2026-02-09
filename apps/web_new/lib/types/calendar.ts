import type { ComponentType } from "react";

export type IconType = "blue" | "green" | "purple";

export interface WeekDateInfo {
  date: number;
  day: string;
  fullDate: Date;
  isToday: boolean;
}

export interface ScheduleItem {
  id: number;
  type: string;
  icon: ComponentType<{ fontSize?: "small" | "inherit" | "medium" | "large" }>;
  company: string;
  title: string;
  date: string;
  time: string;
  color: IconType;
}
