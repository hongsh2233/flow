// src/utils/dayUtil.ts

interface ScheduleItem {
  date: string
  title: string
  type?: string  // 백엔드에서 전달하는 type 필드 ("api" 또는 "manual")
}

interface Holiday {
  date: string
  name: string
}

/**
 * 특정 날짜를 기준으로 주의 날짜 리스트를 가져오며, 날짜별 일정 개수를 포함합니다.
 * @param schedules - [{ date: '2023-10-25', ... }, ...] 형태의 일정 데이터
 * @param baseDate - 기준 날짜 (기본값: 오늘)
 * @param weekOffset - 주 단위 오프셋 (기본값: 0, 양수는 다음 주, 음수는 이전 주)
 * @param holidays - 공휴일 목록
 */
export const getWeeklyDates = (
  schedules: ScheduleItem[] = [],
  baseDate?: Date,
  weekOffset = 0,
  holidays: Holiday[] = []
) => {
  const today = new Date()
  const targetDate = baseDate ? new Date(baseDate) : new Date(today)

  // 주 단위 오프셋 적용 (7일씩 이동)
  if (weekOffset !== 0) {
    targetDate.setDate(targetDate.getDate() + (weekOffset * 7))
  }

  const dayOfWeek = targetDate.getDay()

  // 요일 배열 (한국어)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(targetDate)
    date.setDate(targetDate.getDate() - dayOfWeek + i)

    // 로컬 시간대 기준으로 YYYY-MM-DD 형식의 날짜 문자열 생성
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`

    // 해당 날짜에 포함된 일정 필터링
    const daySchedules = schedules.filter((s) => s.date === dateString)

    // 공휴일 확인
    // 1. 주말 확인
    const isWeekend = i === 0 || i === 6
    // 2. 공휴일 목록 확인
    const isPublicHoliday = holidays.some((h) => h.date === dateString)
    // 3. API로 불러온 공휴일 확인 (type="api"인 일정이 있는 날짜)
    const apiSchedules = schedules.filter((s) => s.date === dateString && s.type === "api")
    const isScheduleHoliday = apiSchedules.length > 0

    // 최종 공휴일 여부 결정
    // API로 불러온 공휴일(type="api")이 있으면 무조건 공휴일로 표시
    // 주말도 공휴일로 표시
    const isHoliday = isWeekend || isPublicHoliday || isScheduleHoliday

    return {
      dayNum: date.getDate(),
      fullDate: dateString,
      dayOfWeek: dayNames[date.getDay()],
      isToday: date.toDateString() === today.toDateString(),
      isHoliday: isHoliday,
      scheduleCount: daySchedules.length, // 해당 날짜의 일정 개수
    }
  })
}
