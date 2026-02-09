"use client";

import { useState } from "react";
import CalendarToday from "@mui/icons-material/CalendarToday";
import AccessTime from "@mui/icons-material/AccessTime";
import Business from "@mui/icons-material/Business";
import Payments from "@mui/icons-material/Payments";
import Groups from "@mui/icons-material/Groups";
import type { IconType, ScheduleItem, WeekDateInfo } from "@/lib/types";
import styles from "./Calendar.module.css";

function getWeekDates(): WeekDateInfo[] {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + diff + i);
    weekDates.push({
      date: date.getDate(),
      day: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
      fullDate: date,
      isToday: date.toDateString() === today.toDateString(),
    });
  }
  return weekDates;
}

const scheduleData: ScheduleItem[] = [
  { id: 1, type: 'earnings', icon: Business, company: '삼성전자', title: '4분기 실적 발표', date: '2월 10일', time: '09:00', color: 'blue' },
  { id: 2, type: 'dividend', icon: Payments, company: 'SK하이닉스', title: '배당금 지급일', date: '2월 10일', time: '전일', color: 'green' },
  { id: 3, type: 'meeting', icon: Groups, company: 'NAVER', title: '정기 주주총회', date: '2월 12일', time: '14:00', color: 'purple' },
  { id: 4, type: 'earnings', icon: Business, company: '카카오', title: '4분기 실적 발표', date: '2월 13일', time: '10:00', color: 'blue' },
  { id: 5, type: 'dividend', icon: Payments, company: '현대차', title: '배당금 지급일', date: '2월 14일', time: '전일', color: 'green' },
  { id: 6, type: 'earnings', icon: Business, company: 'LG화학', title: '4분기 실적 발표', date: '2월 15일', time: '09:30', color: 'blue' },
];

const iconClassMap: Record<IconType, string> = {
  blue: styles.iconBlue,
  green: styles.iconGreen,
  purple: styles.iconPurple,
};

export function Calendar() {
  const weekDates = getWeekDates();
  const [selectedDate, setSelectedDate] = useState(
    weekDates.find((d) => d.isToday)?.date ?? weekDates[0].date
  );

  return (
    <div className={styles.root}>


      <div className={styles.monthWrap}>
        <div className={styles.monthRow}>
          <h3 className={styles.monthTitle}>2월 2026</h3>
          <button type="button" className={styles.calendarBtn} aria-label="캘린더">
            <CalendarToday fontSize="small" />
          </button>
        </div>
      </div>

      <div className={styles.weekWrap}>
        <div className={styles.weekBox}>
          <div className={styles.weekGrid}>
            {weekDates.map((dateInfo) => (
              <button
                key={`${dateInfo.date}-${dateInfo.day}`}
                type="button"
                onClick={() => setSelectedDate(dateInfo.date)}
                className={`${styles.dayBtn} ${
                  selectedDate === dateInfo.date ? styles.dayBtnSelected : ''
                } ${dateInfo.isToday ? styles.dayBtnToday : ''}`}
              >
                <span className={styles.dayLabel}>{dateInfo.day}</span>
                <span className={styles.dayNum}>{dateInfo.date}</span>
                {dateInfo.isToday && selectedDate !== dateInfo.date && (
                  <span className={styles.todayDot} aria-hidden />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.filterWrap}>
        <div className={styles.filterRow}>
          {['전체', '실적발표', '배당', '주주총회'].map((filter) => (
            <button
              key={filter}
              type="button"
              className={`${styles.filterBtn} ${
                filter === '전체' ? styles.filterBtnActive : styles.filterBtnDefault
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scheduleWrap}>
        <h3 className={styles.scheduleTitle}>이번 주 일정</h3>
        <div className={styles.scheduleList}>
          {scheduleData.map((schedule) => {
            const Icon = schedule.icon;
            return (
              <div key={schedule.id} className={styles.scheduleCard}>
                <div className={styles.scheduleInner}>
                  <div className={`${styles.iconBox} ${iconClassMap[schedule.color]}`}>
                    <Icon fontSize="small" />
                  </div>
                  <div className={styles.scheduleContent}>
                    <div className={styles.scheduleTop}>
                      <div>
                        <h4 className={styles.scheduleTitleText}>{schedule.title}</h4>
                        <p className={styles.scheduleCompany}>{schedule.company}</p>
                      </div>
                      <p className={styles.scheduleDate}>{schedule.date}</p>
                    </div>
                    <div className={styles.scheduleTimeRow}>
                      <AccessTime fontSize="inherit" />
                      <span className={styles.scheduleTime}>{schedule.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
