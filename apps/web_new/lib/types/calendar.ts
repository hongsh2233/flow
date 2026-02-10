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
  company: string;
  title: string;
  date: string;
  time: string;
}
