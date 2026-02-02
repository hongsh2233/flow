'use client'

import React, { useState, useEffect } from 'react'
import styles from './Usa.module.css'

interface UsaIndexItem {
  name: string
  symbol: string
  value: string
  change: string
  percent: string
}

interface UsaIndicesResponse {
  success: boolean
  message: string
  data: UsaIndexItem[]
}

export default function UsaIndex() {
  const [indices, setIndices] = useState<UsaIndexItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchIndices = async () => {
    try {
      setLoading(true)
      setError(null)

      // Next.js API 라우트 호출 (Yahoo Finance 프록시)
      const response = await fetch('/api/usa-indices', {
        method: 'GET',
      })

      const result: UsaIndicesResponse = await response.json()

      if (result.success && result.data) {
        setIndices(result.data)
        // 현재 날짜 설정
        const today = new Date()
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        setLastUpdate(dateStr)
      } else {
        setError(result.message || '지수를 가져오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('지수 가져오기 실패:', err)
      setError('지수를 가져오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIndices()
    // 5분마다 자동 갱신
    const interval = setInterval(fetchIndices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getStatusClass = (change: string) => {
    if (change.includes('+')) return styles.up
    if (change.includes('-')) return styles.down
    return ''
  }

  return (
    <div className={styles.usa__wrap}>
      <div className={styles.usa__header}>
        <h2 className={styles.usa__title}>
          {lastUpdate ? `${lastUpdate} 해외지수` : '해외지수'}
        </h2>
      </div>

      {loading && (
        <div className={styles.usa__loading}>지수를 불러오는 중...</div>
      )}

      {error && (
        <div className={styles.usa__error}>{error}</div>
      )}

      {!loading && !error && indices.length > 0 && (
        <ul className={styles.usa__list}>
          {indices.map((item, index) => {
            // NaN 체크 및 기본값 설정
            const change = item.change && !item.change.includes('NaN') ? item.change : '0.00'
            const percent = item.percent && !item.percent.includes('NaN') ? item.percent : '0.00%'
            const value = item.value && !item.value.includes('NaN') ? item.value : '0.00'
            
            const statusClass = getStatusClass(change)
            return (
              <li key={index} className={`${styles.usa__item} ${statusClass}`}>
                <div className={styles.usa__itemContent}>
                  <h3 className={styles.usa__itemTitle}>{item.name}</h3>
                  <p className={styles.usa__itemValue}>{value}</p>
                </div>
                <div className={styles.usa__itemChange}>
                  <span>{change}</span>
                  <span>{percent}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!loading && !error && indices.length === 0 && (
        <div className={styles.usa__empty}>지수 데이터가 없습니다.</div>
      )}
    </div>
  )
}