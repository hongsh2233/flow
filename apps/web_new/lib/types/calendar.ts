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
  dateIso?: string;     // YYYY-MM-DD (시작일) for 공휴일 체크
  endDateIso?: string;  // YYYY-MM-DD (종료일, 기간 일정)
  time?: string;
  content?: string;
  detail?: string;
  link_url?: string;    // 증권사 MTS/모바일웹 링크 등 외부 URL
}
