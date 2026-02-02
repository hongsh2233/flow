'use client'

import * as React from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Swiper as SwiperType } from 'swiper'
import styles from './Calendar.module.css'
import WeeklyDay from './WeeklyDay'
import MonthlyDay from './MonthlyDay'
import ScaduleList from './ScaduleList'
import { fetchHolidays } from '@/lib/services/holidayService'
import type { Holiday } from '@/lib/types/api'

interface ScheduleItem {
  date: string
  title: string
  content?: string
  type?: string  // 백엔드에서 전달하는 type 필드 ("api" 또는 "manual")
}

interface CalendarProps {
  schedules: ScheduleItem[]
}

export default function Calendar({ schedules }: CalendarProps) {
  const swiperRef = useRef<SwiperType | null>(null)

  // 로컬 시간대 기준으로 YYYY-MM-DD 형식의 날짜 문자열 반환
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 오늘 날짜를 초기 선택값으로 설정 (YYYY-MM-DD 형식)
  const [selectedDate, setSelectedDate] = useState<string>(
    getLocalDateString(new Date())
  )

  // 현재 주 인덱스 (0이 오늘 주)
  const [currentWeekIndex, setCurrentWeekIndex] = useState<number>(0)
  
  // 현재 표시 중인 월 (YYYY년 M월 형식)
  const [displayMonth, setDisplayMonth] = useState<string>('')
  
  // 달력 모드: 'week' (주간) 또는 'month' (월간)
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week')
  
  // 월간 달력에서 현재 표시 중인 월 오프셋 (0: 이번달, -1: 지난달, 1: 다음달)
  const [currentMonthOffset, setCurrentMonthOffset] = useState<number>(0)

  // 공휴일 데이터 상태
  const [holidays, setHolidays] = useState<Holiday[]>([])

  // 공휴일 데이터 로드
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const currentYear = new Date().getFullYear()
        const result = await fetchHolidays(currentYear)
        if (result.success && result.data) {
          setHolidays(result.data)
        }
        } catch (error) {
        // 공휴일 데이터 로딩 실패 (무시)
      }
    }
    loadHolidays()
  }, [])

  // 선택된 날짜와 일치하는 일정들만 필터링
  const filteredSchedules = schedules.filter(
    (item) => item.date === selectedDate
  )

  // 현재 표시 중인 월 계산 함수
  const calculateDisplayMonth = (weekOffset: number) => {
    const today = new Date()
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + (weekOffset * 7))
    
    // 해당 주의 첫 번째 날짜 (일요일)
    const dayOfWeek = targetDate.getDay()
    const firstDayOfWeek = new Date(targetDate)
    firstDayOfWeek.setDate(targetDate.getDate() - dayOfWeek)
    
    const year = firstDayOfWeek.getFullYear()
    const month = firstDayOfWeek.getMonth() + 1
    
    return `${year}년 ${month}월`
  }

  // Swiper 슬라이드 변경 시 주 인덱스 및 월 정보 업데이트
  const handleSlideChange = (swiper: SwiperType) => {
    const newWeekIndex = swiper.activeIndex - 10 // 중앙(10번째) 슬라이드가 기준
    setCurrentWeekIndex(newWeekIndex)
    
    // 표시 중인 월 업데이트
    const month = calculateDisplayMonth(newWeekIndex)
    setDisplayMonth(month)
  }

  // 오늘 날짜로 이동하는 함수
  const handleGoToToday = () => {
    const today = getLocalDateString(new Date())
    setSelectedDate(today)
    if (calendarMode === 'week') {
      if (swiperRef.current) {
        swiperRef.current.slideTo(10, 300) // 중앙(10번째) 슬라이드로 부드럽게 이동
      }
    } else if (calendarMode === 'month') {
      // 월간 달력에서 오늘로 이동
      setCurrentMonthOffset(0)
      if (swiperRef.current) {
        swiperRef.current.slideTo(monthSlidesConfig.centerIndex, 300) // 현재 달 슬라이드로 이동
      }
      // 월 표시 업데이트
      const month = calculateMonthlyDisplayMonth(0)
      setDisplayMonth(month)
    }
  }
  
  // 전체일정보기 버튼 클릭 핸들러 (주간 ↔ 월간 전환)
  const handleViewAllClick = () => {
    if (calendarMode === 'week') {
      setCalendarMode('month')
      // 선택된 날짜의 월로 이동
      const selectedDateObj = new Date(selectedDate)
      const todayObj = new Date()
      const yearDiff = selectedDateObj.getFullYear() - todayObj.getFullYear()
      const monthDiff = (selectedDateObj.getMonth() - todayObj.getMonth()) + (yearDiff * 12)
      setCurrentMonthOffset(monthDiff)
      // 월 표시 업데이트
      const month = calculateMonthlyDisplayMonth(monthDiff)
      setDisplayMonth(month)
      // Swiper를 해당 월로 이동 (비동기로 처리)
      setTimeout(() => {
        if (swiperRef.current) {
          // monthDiff를 슬라이드 인덱스로 변환
          const slideIndex = monthDiff + monthSlidesConfig.centerIndex
          swiperRef.current.slideTo(slideIndex, 300)
        }
      }, 0)
    } else {
      setCalendarMode('week')
      // 주간 달력으로 전환 시 중앙 슬라이드로 이동
      if (swiperRef.current) {
        swiperRef.current.slideTo(10, 300)
      }
      // 월 표시 업데이트
      const initialMonth = calculateDisplayMonth(0)
      setDisplayMonth(initialMonth)
    }
  }
  
  // 월간 달력의 월 계산 함수
  const calculateMonthlyDisplayMonth = (monthOffset: number) => {
    const today = new Date()
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
    const year = targetMonth.getFullYear()
    const month = targetMonth.getMonth() + 1 // getMonth()는 0부터 시작하므로 +1
    return `${year}년 ${month}월`
  }
  
  // 월간 달력에서 이전 달로 이동
  const handlePreviousMonth = () => {
    if (calendarMode === 'month' && swiperRef.current) {
      swiperRef.current.slidePrev()
    }
  }
  
  // 월간 달력에서 다음 달로 이동
  const handleNextMonth = () => {
    if (calendarMode === 'month' && swiperRef.current) {
      swiperRef.current.slideNext()
    }
  }
  
  // 월간 달력에서 이전/다음 달 이동
  const handleMonthlySlideChange = (swiper: SwiperType) => {
    const newMonthIndex = swiper.activeIndex - monthSlidesConfig.centerIndex // 현재 달 인덱스 기준
    setCurrentMonthOffset(newMonthIndex)
    const month = calculateMonthlyDisplayMonth(newMonthIndex)
    setDisplayMonth(month)
  }

  // 초기 월 표시 설정
  useEffect(() => {
    if (calendarMode === 'week') {
      const initialMonth = calculateDisplayMonth(0)
      setDisplayMonth(initialMonth)
      setCurrentWeekIndex(0)
    } else {
      const initialMonth = calculateMonthlyDisplayMonth(0)
      setDisplayMonth(initialMonth)
      setCurrentMonthOffset(0)
    }
  }, [calendarMode])

  // 주 단위로 슬라이드를 생성 (최대 3개월: 이번달 기준 전 1개월, 후 1개월)
  // 3개월 ≈ 12주이므로 최대 12주 정도로 제한
  // 현재는 21주로 설정되어 있지만, 사용자가 원하면 제한할 수 있음
  const weekSlides = Array.from({ length: 21 }, (_, i) => i - 10)

  // 월간 달력 슬라이드 범위 계산
  // 2025년 1월부터 현재 달까지 + 현재 달부터 +3개월
  const monthSlidesConfig = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-based (0: 1월, 11: 12월)

    // 2025년 1월을 기준점으로 설정
    const minYear = 2025
    const minMonth = 0 // 1월 (0-based)

    // 과거 범위: 2025년 1월부터 현재 달까지의 개월 수
    const monthsFromMin = (currentYear - minYear) * 12 + (currentMonth - minMonth)

    // 미래 범위: 현재 달부터 +3개월
    const futureMonths = 3

    // 총 슬라이드 개수
    const totalSlides = monthsFromMin + futureMonths + 1 // +1은 현재 달 포함

    // 슬라이드 오프셋 배열 생성 (-monthsFromMin부터 +futureMonths까지)
    return {
      slides: Array.from({ length: totalSlides }, (_, i) => i - monthsFromMin),
      centerIndex: monthsFromMin, // 현재 달의 인덱스
      minOffset: -monthsFromMin,
      maxOffset: futureMonths
    }
  }, [])

  const monthSlides = monthSlidesConfig.slides
  
  // 오늘 날짜 확인
  const today = getLocalDateString(new Date())
  const isTodaySelected = selectedDate === today

  return (
    <div className={styles.calendar__wrap}>
      <div className={styles.calendarHeader}>
        <div className={styles.monthDisplay}>{displayMonth}</div>
        <div className={styles.headerButtons}>
          {calendarMode === 'month' && (
            <>
              <button 
                type="button"
                onClick={handlePreviousMonth}
                className={styles.monthNavButton}
              >
                이전달
              </button>
              <button 
                type="button"
                onClick={handleNextMonth}
                className={styles.monthNavButton}
              >
                다음달
              </button>
            </>
          )}
          <button 
            type="button"
            onClick={handleGoToToday}
            className={`${styles.todayButton} ${isTodaySelected ? styles.todayButtonActive : ''}`}
          >
            오늘
          </button>
        </div>
      </div>
      
      {calendarMode === 'week' ? (
        <div className={styles.swiperContainer}>
          <Swiper
            onSwiper={(swiper) => {
              swiperRef.current = swiper
              // 초기 위치를 중앙(10번째 슬라이드)으로 설정
              swiper.slideTo(10, 0)
            }}
            onSlideChange={handleSlideChange}
            slidesPerView={1}
            spaceBetween={0}
            allowSlidePrev={true}
            allowSlideNext={true}
            className={styles.calendarSwiper}
          >
            {weekSlides.map((weekOffset) => (
              <SwiperSlide key={weekOffset}>
                <WeeklyDay
                  schedules={schedules}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  weekOffset={weekOffset}
                  holidays={holidays}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : (
        <div className={styles.swiperContainer}>
          <Swiper
            onSwiper={(swiper) => {
              swiperRef.current = swiper
              // 초기 위치를 현재 달로 설정
              swiper.slideTo(monthSlidesConfig.centerIndex, 0)
            }}
            onSlideChange={handleMonthlySlideChange}
            slidesPerView={1}
            spaceBetween={0}
            allowSlidePrev={true}
            allowSlideNext={true}
            className={styles.calendarSwiper}
          >
            {monthSlides.map((monthOffset) => (
              <SwiperSlide key={monthOffset}>
                <MonthlyDay
                  schedules={schedules}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  monthOffset={monthOffset}
                  holidays={holidays}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
      
      {/* 필터링된 일정과 선택된 날짜 정보를 전달 */}
      <ScaduleList 
        selectedDate={selectedDate} 
        items={filteredSchedules}
        onViewAllClick={handleViewAllClick}
        calendarMode={calendarMode}
      />
    </div>
  )
}
