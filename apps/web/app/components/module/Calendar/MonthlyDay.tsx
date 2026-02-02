'use client'

import * as React from 'react'
import styles from './Calendar.module.css'

interface ScheduleItem {
  date: string
  title: string
  content?: string
  type?: string
}

interface Holiday {
  date: string
  name: string
}

interface MonthlyDayProps {
  schedules: ScheduleItem[]
  selectedDate: string
  onSelectDate: (date: string) => void
  monthOffset?: number // 0: 이번달, -1: 지난달, 1: 다음달
  holidays?: Holiday[]
}

export default function MonthlyDay({ 
  schedules, 
  selectedDate, 
  onSelectDate, 
  monthOffset = 0,
  holidays = [] 
}: MonthlyDayProps) {
  // 기준 월 계산
  const today = new Date()
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const year = targetMonth.getFullYear()
  const month = targetMonth.getMonth()

  // 해당 월의 첫 번째 날과 마지막 날
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay() // 0 (일요일) ~ 6 (토요일)

  // 이번 달의 모든 날들만 표시 (1일 ~ 말일)
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // 빈 칸 개수 계산 (첫 날 전의 빈 칸)
  const emptyCellsBefore = startDayOfWeek

  // 마지막 날 이후의 빈 칸 (주를 7일로 맞추기 위해 필요한 빈 칸)
  const totalCells = startDayOfWeek + daysInMonth
  const weeksNeeded = Math.ceil(totalCells / 7)
  const totalCellsNeeded = weeksNeeded * 7
  const emptyCellsAfter = totalCellsNeeded - totalCells

  // 로컬 시간대 기준으로 YYYY-MM-DD 형식의 날짜 문자열 반환
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 날짜 클릭 핸들러
  const handleDateClick = (day: number) => {
    const clickDate = new Date(year, month, day)
    const dateString = getLocalDateString(clickDate)
    onSelectDate(dateString)
  }

  // 날짜 렌더링 헬퍼 함수
  const renderDay = (day: number) => {
    const date = new Date(year, month, day)
    const dateString = getLocalDateString(date)
    const isSelected = dateString === selectedDate
    const todayDateString = getLocalDateString(new Date())
    const isToday = dateString === todayDateString
    
    // 해당 날짜의 일정 개수
    const daySchedules = schedules.filter((s) => s.date === dateString)
    const scheduleCount = daySchedules.length
    
    // 공휴일 확인
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isPublicHoliday = holidays.some((h) => h.date === dateString)
    
    // API 일정 중 공휴일인 것만 체크 (제목에 "공휴일"이 포함된 경우만)
    const apiSchedules = schedules.filter((s) => s.date === dateString && s.type === "api")
    const isScheduleHoliday = apiSchedules.some((s) => s.title && s.title.includes("공휴일"))
    
    // 주말이거나 공휴일인 경우만 공휴일로 표시
    const isHoliday = isWeekend || isPublicHoliday || isScheduleHoliday

    const buttonClass = [
      isToday ? styles.today : '',
      isHoliday ? styles.holday : '',
      isSelected ? styles.selected : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        key={`day-${day}`}
        type="button"
        className={buttonClass || undefined}
        onClick={() => handleDateClick(day)}
      >
        <div className={styles.day}>{day}</div>
        {scheduleCount > 0 && (
          <div className={styles.monthlyScheduleDot}></div>
        )}
      </button>
    )
  }

  // 요일 헤더
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className={styles.monthly__wrap}>
      <div className={styles.dayNames}>
        {dayNames.map((dayName) => (
          <div key={dayName} className={styles.dayName}>
            {dayName}
          </div>
        ))}
      </div>
      <div className={styles.monthlyGrid}>
        {/* 첫 날 전의 빈 칸 */}
        {Array.from({ length: emptyCellsBefore }).map((_, idx) => (
          <div key={`empty-before-${idx}`} className={styles.emptyCell}></div>
        ))}
        
        {/* 이번 달의 모든 날들 (1일 ~ 말일) */}
        {currentMonthDays.map((day) => renderDay(day))}
        
        {/* 마지막 날 이후의 빈 칸 */}
        {Array.from({ length: emptyCellsAfter }).map((_, idx) => (
          <div key={`empty-after-${idx}`} className={styles.emptyCell}></div>
        ))}
      </div>
    </div>
  )
}

