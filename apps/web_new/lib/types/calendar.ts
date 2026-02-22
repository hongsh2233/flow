export interface WeekDateInfo {
  date: number;
  day: string;
  /** 0(일) ~ 6(토) */
  dayOfWeek: number;
  fullDate: Date;
  isToday: boolean;
}

export type NotifyTiming = "1min" | "30min" | "1day" | "2day";

export interface ScheduleItem {
  id: number;
  type: string;
  company?: string;
  title: string;
  subject?: string;  // API subject (alias for title)
  date: string;
  dateIso?: string;  // YYYY-MM-DD for 공휴일 체크
  time?: string;
  content?: string;
  detail?: string;
  /** 주관 증권사 (공모청약 등) */
  underwriter?: string;
}
