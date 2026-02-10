"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import CalendarToday from "@mui/icons-material/CalendarToday";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import type { ScheduleItem } from "@/lib/types";
import { getWeeksRange } from "@/lib/utils/calendar";
import { ScheduleCard } from "./ScheduleCard";
import styles from "./Calendar.module.css";

const scheduleData: ScheduleItem[] = [
  { id: 1, type: "earnings", company: "삼성전자", title: "4분기 실적 발표", date: "2월 10일", time: "09:00" },
  { id: 2, type: "dividend", company: "SK하이닉스", title: "배당금 지급일", date: "2월 10일", time: "전일" },
  { id: 3, type: "meeting", company: "NAVER", title: "정기 주주총회", date: "2월 12일", time: "14:00" },
  { id: 4, type: "earnings", company: "카카오", title: "4분기 실적 발표", date: "2월 13일", time: "10:00" },
  { id: 5, type: "dividend", company: "현대차", title: "배당금 지급일", date: "2월 14일", time: "전일" },
  { id: 6, type: "earnings", company: "LG화학", title: "4분기 실적 발표", date: "2월 15일", time: "09:30" },
];

const MONTH_NAMES = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

function getMonthLabel(weekDates: { fullDate: Date }[]): string {
  const first = weekDates[0].fullDate;
  const last = weekDates[6].fullDate;

  if (first.getMonth() === last.getMonth()) {
    return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${MONTH_NAMES[first.getMonth()]}–${MONTH_NAMES[last.getMonth()]} ${first.getFullYear()}`;
  }
  return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()} – ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
}

export function Calendar() {
  const { weeks, todayWeekIndex } = useMemo(() => getWeeksRange(5), []);
  const [weekIndex, setWeekIndex] = useState(todayWeekIndex);
  const currentWeek = weeks[weekIndex];

  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toDateString()
  );

  /* ── 스와이프 ── */
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const weekBoxRef = useRef<HTMLDivElement>(null);

  const goWeek = useCallback(
    (dir: -1 | 1) => {
      setWeekIndex((prev) => Math.max(0, Math.min(weeks.length - 1, prev + dir)));
    },
    [weeks.length]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const dx = e.changedTouches[0].clientX - touchRef.current.startX;
      const dy = e.changedTouches[0].clientY - touchRef.current.startY;
      touchRef.current = null;

      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
      goWeek(dx < 0 ? 1 : -1);
    },
    [goWeek]
  );

  /* 오늘로 돌아가기 */
  const goToday = useCallback(() => {
    setWeekIndex(todayWeekIndex);
    setSelectedDate(new Date().toDateString());
  }, [todayWeekIndex]);

  const monthLabel = getMonthLabel(currentWeek);
  const isThisWeek = weekIndex === todayWeekIndex;

  return (
    <div className={styles.root}>
      {/* 월 + 네비게이션 */}
      <div className={styles.monthWrap}>
        <div className={styles.monthRow}>
          <div className={styles.monthLeft}>
            <h3 className={styles.monthTitle}>{monthLabel}</h3>
            {!isThisWeek && (
              <button
                type="button"
                className={styles.todayBtn}
                onClick={goToday}
              >
                오늘
              </button>
            )}
          </div>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => goWeek(-1)}
              disabled={weekIndex === 0}
              aria-label="이전 주"
            >
              <ChevronLeft fontSize="small" />
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => goWeek(1)}
              disabled={weekIndex === weeks.length - 1}
              aria-label="다음 주"
            >
              <ChevronRight fontSize="small" />
            </button>
          </div>
        </div>
      </div>

      {/* 주간 캘린더 (스와이프) */}
      <div
        className={styles.weekWrap}
        ref={weekBoxRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.weekBox}>
          <div className={styles.weekGrid}>
            {currentWeek.map((dateInfo) => {
              const dateStr = dateInfo.fullDate.toDateString();
              const isSelected = selectedDate === dateStr;
              const isHoliday = dateInfo.dayOfWeek === 0 || dateInfo.dayOfWeek === 6;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`${styles.dayBtn} ${
                    isSelected ? styles.dayBtnSelected : ""
                  } ${dateInfo.isToday && !isSelected ? styles.dayBtnToday : ""} ${
                    isHoliday && !isSelected ? styles.dayBtnHoliday : ""
                  }`}
                >
                  <span className={styles.dayLabel}>{dateInfo.day}</span>
                  <span className={styles.dayNum}>{dateInfo.date}</span>
                  {dateInfo.isToday && !isSelected && (
                    <span className={styles.todayDot} aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className={styles.filterWrap}>
        <div className={styles.filterRow}>
          {["전체", "실적발표", "배당", "주주총회"].map((filter) => (
            <button
              key={filter}
              type="button"
              className={`${styles.filterBtn} ${
                filter === "전체" ? styles.filterBtnActive : styles.filterBtnDefault
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* 일정 */}
      <div className={styles.scheduleWrap}>
        <h3 className={styles.scheduleTitle}>이번 주 일정</h3>
        <div className={styles.scheduleList}>
          {scheduleData.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      </div>
    </div>
  );
}
