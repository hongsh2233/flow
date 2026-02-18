import type { WeekDateInfo } from "@/lib/types";

/** Date를 로컬(한국) 시간 기준 YYYY-MM-DD로 변환 (toISOString은 UTC라 공휴일 매칭 오류 발생) */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 특정 날짜가 속한 주의 일요일을 반환합니다. */
function getSunday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0(일) ~ 6(토)
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** 하나의 주(일~토) 날짜 정보를 생성합니다. */
function buildWeek(sunday: Date, today: Date): WeekDateInfo[] {
  const todayStr = today.toDateString();
  const week: WeekDateInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    week.push({
      date: date.getDate(),
      day: ["일", "월", "화", "수", "목", "금", "토"][date.getDay()],
      dayOfWeek: date.getDay(),
      fullDate: date,
      isToday: date.toDateString() === todayStr,
    });
  }
  return week;
}

/**
 * 오늘 기준 ±weeksOffset 주 범위의 주간 배열을 반환합니다.
 * 주는 일요일부터 시작합니다.
 * 기본값: 전후 5주 (약 ±1개월)
 * @returns { weeks, todayWeekIndex }
 */
export function getWeeksRange(weeksOffset = 5): {
  weeks: WeekDateInfo[][];
  todayWeekIndex: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisSunday = getSunday(today);

  const weeks: WeekDateInfo[][] = [];

  for (let w = -weeksOffset; w <= weeksOffset; w++) {
    const sunday = new Date(thisSunday);
    sunday.setDate(thisSunday.getDate() + w * 7);
    weeks.push(buildWeek(sunday, today));
  }

  return { weeks, todayWeekIndex: weeksOffset };
}

