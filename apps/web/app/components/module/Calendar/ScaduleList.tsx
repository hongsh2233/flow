'use client'

import * as React from 'react'
import styles from './Calendar.module.css'

interface ScheduleItem {
  date: string
  title: string
  content?: string // cont는 선택적 속성으로 정의
  isHoliday?: boolean  // 공휴일 여부
}

interface ScaduleListProps {
  selectedDate: string
  items: ScheduleItem[]
  onViewAllClick?: () => void
  calendarMode?: 'week' | 'month'
}

export default function ScaduleList({ selectedDate, items, onViewAllClick, calendarMode = 'week' }: ScaduleListProps) {
  return (
    <div className={styles.calendar__detail}>
      <div className={styles.calendar__items}>
        <h3>{selectedDate} 일정</h3>

        {items.length > 0 ? (
          <ul className={styles.scadule__list}>
            {items.map((item, index) => (
              <li 
                key={index} 
                className={`${styles.scadule__item} ${item.isHoliday ? styles.holiday : ''}`}
              >
                <div className={`${styles.scadule__title} ${item.isHoliday ? styles.holiday : ''}`}>
                  {item.title}
                </div>
                {/* cont가 존재할 경우에만 렌더링 */}
                {item.content && (
                  <div className={styles.scadule__cont}>{item.content}</div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.no__scadule}>등록된 일정이 없습니다.</div>
        )}
        
        {onViewAllClick && (
          <button 
            type="button"
            className={styles.viewAllButton}
            onClick={onViewAllClick}
          >
            {calendarMode === 'week' ? '전체일정보기' : '주간으로 보기'}
          </button>
        )}
      </div>
    </div>
  )
}
