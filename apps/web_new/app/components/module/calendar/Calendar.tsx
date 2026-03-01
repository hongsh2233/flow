"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import type { ScheduleItem } from "@/lib/types";
import { getWeeksRange, toIsoDateLocal } from "@/lib/utils/calendar";
import { fetchSchedules } from "@/lib/services/scheduleService";
import { useAlarmStore } from "@/lib/stores/useAlarmStore";
import { ScheduleCard } from "./ScheduleCard";
import styles from "./Calendar.module.css";

const MONTH_NAMES = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

const SCHEDULE_FILTERS = [
  { value: "all", label: "전체" },
  { value: "api", label: "공휴일" },
  { value: "earnings", label: "실적발표" },
  { value: "ipo", label: "공모청약" },
  { value: "dividend", label: "배당" },
  { value: "news", label: "소식" },
  { value: "etc", label: "기타" },
] as const;

type FilterType = (typeof SCHEDULE_FILTERS)[number]["value"];

function formatDateDisplay(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

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
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const email = session?.user?.email;

  /* 알림 구독 전역 store */
  const { alarmMap, fetched, fetchAlarms, reset } = useAlarmStore();

  const { weeks, todayWeekIndex } = useMemo(() => getWeeksRange(5), []);
  const [weekIndex, setWeekIndex] = useState(todayWeekIndex);
  const [filter, setFilter] = useState<FilterType>("all");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const currentWeek = weeks[weekIndex];

  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toDateString()
  );

  /* 로그인 시 알림 구독 목록 로드 (미fetch 상태일 때만 서버 요청) */
  useEffect(() => {
    if (!email) {
      reset();
      return;
    }
    if (!fetched) {
      fetchAlarms();
    }
  }, [email, fetched]);

  /* API 일정 로드 */
  const startDate = currentWeek[0]?.fullDate;
  const endDate = currentWeek[6]?.fullDate;
  useEffect(() => {
    if (!startDate || !endDate) return;
    const load = async () => {
      setLoading(true);
      setFetchError(null);
      const start = toIsoDateLocal(startDate);
      const end = toIsoDateLocal(endDate);
      const typeFilter = filter === "all" ? undefined : (filter as string);
      const res = await fetchSchedules(start, end, typeFilter);
      if (res.success && res.data) {
        const items: ScheduleItem[] = res.data.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.subject,
          subject: s.subject,
          date: formatDateDisplay(new Date(s.date)),
          dateIso: s.date,
          endDateIso: s.end_date ?? undefined,
          time: s.scheduled_time || undefined,
          content: s.content || undefined,
          detail: s.detail != null && s.detail !== "" ? String(s.detail) : undefined,
        }));
        setSchedules(items);
      } else {
        setSchedules([]);
        setFetchError(res.message || "일정을 불러오는데 실패했습니다.");
      }
      setLoading(false);
    };
    load();
  }, [startDate?.toISOString(), endDate?.toISOString(), filter]);

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

  /* 날짜별 일정 개수 (기간 일정 포함) */
  const scheduleDateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    schedules.forEach((s) => {
      if (!s.dateIso) return;
      currentWeek.forEach((d) => {
        const dIso = toIsoDateLocal(d.fullDate);
        const covers = s.endDateIso
          ? s.dateIso! <= dIso && s.endDateIso >= dIso
          : s.dateIso === dIso;
        if (covers) counts[dIso] = (counts[dIso] || 0) + 1;
      });
    });
    return counts;
  }, [schedules, currentWeek]);

  const monthLabel = getMonthLabel(currentWeek);
  const isThisWeek = weekIndex === todayWeekIndex;

  /* 선택한 날짜부터 이후 일정만 표시 (오늘 이전 날짜 일정 숨김) */
  const selectedDateIso = toIsoDateLocal(new Date(selectedDate));
  const filteredSchedules = useMemo(
    () =>
      schedules.filter((s) => {
        // 기간 일정(endDateIso 있음): 종료일이 선택 날짜 이후면 표시
        if (s.endDateIso) return s.endDateIso >= selectedDateIso;
        // 단일 일정: 시작일이 선택 날짜 이후면 표시
        return (s.dateIso || "") >= selectedDateIso;
      }),
    [schedules, selectedDateIso]
  );

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
              const dateIso = toIsoDateLocal(dateInfo.fullDate);
              const isSelected = selectedDate === dateStr;
              const isWeekend = dateInfo.dayOfWeek === 0 || dateInfo.dayOfWeek === 6;
              const isPublicHoliday = schedules.some(
                (s) => s.dateIso === dateIso && s.type === "api"
              );
              const isHoliday = isWeekend || isPublicHoliday;
              const eventCount = Math.min(scheduleDateCounts[dateIso] || 0, 3);
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
                  {!isSelected && eventCount > 0 ? (
                    <span className={styles.dotsRow} aria-hidden>
                      {Array.from({ length: eventCount }).map((_, i) => (
                        <span key={i} className={styles.eventDot} />
                      ))}
                    </span>
                  ) : (
                    dateInfo.isToday && !isSelected && (
                      <span className={styles.todayDot} aria-hidden />
                    )
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
          {SCHEDULE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`${styles.filterBtn} ${
                filter === f.value ? styles.filterBtnActive : styles.filterBtnDefault
              }`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 일정 목록: 선택한 날짜부터 이후 일정만 표시 */}
      <div className={styles.scheduleWrap}>
        <h3 className={styles.scheduleTitle}>일정 목록</h3>
        {loading ? (
          <p className={styles.scheduleLoading}>일정을 불러오는 중...</p>
        ) : fetchError ? (
          <p className={styles.scheduleError}>{fetchError}</p>
        ) : filteredSchedules.length === 0 ? (
          <p className={styles.scheduleEmpty}>
            {schedules.length === 0
              ? "해당 기간 일정이 없습니다."
              : `${selectedDateIso} 이후 일정이 없습니다.`}
          </p>
        ) : (
          <div className={styles.scheduleList}>
            {filteredSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                canUseAlarm={isLoggedIn}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
