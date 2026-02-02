'use client'

import React, { useState, useEffect } from 'react'
import styles from './ExchangeRate.module.css'

interface ExchangeRateItem {
  name: string
  value: string
  change: string
  percent: string
}

interface ExchangeRateResponse {
  success: boolean
  data: ExchangeRateItem[]
}

export default function ExchangeRate() {
  const [rates, setRates] = useState<ExchangeRateItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/exchange-rate')
      const result: ExchangeRateResponse = await response.json()

      if (result.success && result.data) {
        setRates(result.data)
      } else {
        setError('환율 정보를 가져오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('환율 가져오기 실패:', err)
      setError('환율을 가져오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
    // 5분마다 자동 갱신
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getStatusClass = (change: string) => {
    if (change.includes('+')) return styles.up
    if (change.includes('-')) return styles.down
    return ''
  }

  return (
    <div className={styles.exchange__wrap}>
      <div className={styles.exchange__header}>
        <h2 className={styles.exchange__title}>환율</h2>
      </div>

      {loading && (
        <div className={styles.exchange__loading}>환율을 불러오는 중...</div>
      )}

      {error && (
        <div className={styles.exchange__error}>{error}</div>
      )}

      {!loading && !error && rates.length > 0 && (
        <ul className={styles.exchange__list}>
          {rates.map((item, index) => {
            const statusClass = getStatusClass(item.change)
            return (
              <li key={index} className={`${styles.exchange__item} ${statusClass}`}>
                <div className={styles.exchange__itemContent}>
                  <h3 className={styles.exchange__itemTitle}>{item.name}</h3>
                  <p className={styles.exchange__itemValue}>{item.value}</p>
                </div>
                <div className={styles.exchange__itemChange}>
                  <span>{item.change}</span>
                  <span>{item.percent}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!loading && !error && rates.length === 0 && (
        <div className={styles.exchange__empty}>환율 데이터가 없습니다.</div>
      )}
    </div>
  )
}

