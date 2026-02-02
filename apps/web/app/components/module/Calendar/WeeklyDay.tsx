'use client'

import * as React from 'react'
import styles from './Calendar.module.css'
import { getWeeklyDates } from './dayUtil'

interface ScheduleItem {
  date: string
  title: string
  type?: string  // 백엔드에서 전달하는 type 필드 ("api" 또는 "manual")
}

interface Holiday {
  date: string
  name: string
}

interface WeeklyDayProps {
  schedules: ScheduleItem[]
  selectedDate: string
  onSelectDate: (date: string) => void
  weekOffset?: number
  holidays?: Holiday[]
}

export default function WeeklyDay({ schedules, selectedDate, onSelectDate, weekOffset = 0, holidays = [] }: WeeklyDayProps) {
  // 1. 전달받은 일정을 유틸리티 함수에 넣어 해당 주의 날짜 데이터를 생성합니다.
  const weekDates = getWeeklyDates(schedules, undefined, weekOffset, holidays)

  const handleDateClick = (fullDate: string) => {
    onSelectDate(fullDate)
  }

  return (
    <div className={styles.weekly__wrap}>
      <div className={styles.dayGrid}>
        {weekDates.map((item, index) => {
          const isSelected = item.fullDate === selectedDate
          // 공휴일 확인: API로 불러온 공휴일이 있는 날짜는 holday 클래스 추가
          const isHoliday = item.isHoliday
          
          const buttonClass = [
            item.isToday ? styles.today : '',
            isHoliday ? styles.holday : '',
            isSelected ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={index}
              type="button"
              className={buttonClass || undefined}
              onClick={() => handleDateClick(item.fullDate)}
            >
              <div className={styles.weekLabel}>{item.dayOfWeek}</div>
              <div className={styles.day}>{item.dayNum}</div>

              {/* 2. 일정 점(circle) 표시 로직 */}
              {item.scheduleCount > 0 && (
                <div className={styles.scaduleWrap}>
                  {/* 최대 3개까지만 표시 */}
                  {Array.from({ length: Math.min(item.scheduleCount, 3) }).map(
                    (_, dotIdx) => (
                      <div key={dotIdx} className={styles.circle}></div>
                    )
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
