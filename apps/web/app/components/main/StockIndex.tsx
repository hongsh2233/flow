'use client'

import React from 'react'
import styles from './Stock.module.css'

// 1. 전달받을 지표 데이터의 인터페이스 정의
interface IndexItem {
  name: string
  value: string
  change: string
  percent: string
}

interface StockIndexProps {
  indices: IndexItem[]
  timestamp?: string
}

export default function StockIndex({ indices = [], timestamp = '' }: StockIndexProps) {
  // 등락에 따른 클래스 반환 함수 (percent와 change 값 모두 확인)
  const getStatusClass = (percent: string, change: string) => {
    // change 값을 먼저 확인 (더 정확함)
    if (change && typeof change === 'string') {
      const changeTrimmed = change.trim()
      if (changeTrimmed.startsWith('+')) {
        return styles.up
      }
      if (changeTrimmed.startsWith('-')) {
        return styles.down
      }
      // 부호가 없는 경우 숫자 값으로 판단
      const changeNum = parseFloat(changeTrimmed)
      if (!isNaN(changeNum)) {
        if (changeNum > 0) return styles.up
        if (changeNum < 0) return styles.down
      }
    }
    
    // change 값이 없거나 판단 불가능한 경우 percent 값으로 판단
    if (!percent || typeof percent !== 'string') return ''
    
    const trimmed = percent.trim()
    
    // "+"로 시작하면 상승
    if (trimmed.startsWith('+')) {
      return styles.up
    }
    
    // "-"로 시작하면 하락
    if (trimmed.startsWith('-')) {
      return styles.down
    }
    
    // 부호가 없는 경우 숫자 값으로 판단 (% 제거 후 파싱)
    const numStr = trimmed.replace('%', '').trim()
    const numValue = parseFloat(numStr)
    
    if (isNaN(numValue)) return ''
    if (numValue > 0) return styles.up
    if (numValue < 0) return styles.down
    return ''
  }

  return (
    <div className={styles.indexContainer}>
      {timestamp && (
        <div className={styles.timestamp}>{timestamp} 기준</div>
      )}
      <div className={styles.indexbox__wrap}>
        {indices.map((item, idx) => {
          const statusClass = getStatusClass(item.percent, item.change)

          return (
            <div key={idx} className={`${styles.stockIndex} ${statusClass}`}>
              <h3>{item.name}</h3>
              <div className={styles.value}>{item.value}</div>
              <div className={styles.subText}>
                <div>{item.change}</div>
                <div>{item.percent}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
