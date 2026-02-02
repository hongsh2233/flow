'use client'

import React, { useState, useEffect } from 'react'
import styles from './MainTop.module.css'
import { formatDateTime } from '../../../src/utils/date'

interface Quote {
  id: number
  text: string
  author: string
}

interface QuoteResponse {
  success: boolean
  data: Quote | null
  message?: string
}

export default function MainTop() {
  const [currentTime, setCurrentTime] = useState(() =>
    formatDateTime(new Date())
  )
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState<boolean>(true)

  useEffect(() => {
    // 1초마다 시간 업데이트
    const interval = setInterval(() => {
      setCurrentTime(formatDateTime(new Date()))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // 명언 API 호출
    const fetchQuote = async () => {
      try {
        setQuoteLoading(true)
        const response = await fetch('/api/quotes')

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: QuoteResponse = await response.json()

        if (result.success && result.data) {
          setQuote(result.data)
        }
      } catch (error) {
        console.error('명언 가져오기 실패:', error)
        // 에러 발생 시 기본 명언 사용
        setQuote({
          id: 0,
          text: '잃지 마라! 그리고 첫 번째 규칙을 잊지 마라!',
          author: '워렌 버핏',
        })
      } finally {
        setQuoteLoading(false)
      }
    }

    fetchQuote()
  }, [])

  return (
    <div className={styles.mainTop__wrap}>
      <div className={styles.mainTop__text}>
        주식정보 <strong>주리니</strong> 입니다.
      </div>
      <div className={styles.mainTop__content}>
        {currentTime ? (
          <>
            {currentTime.dateStr} <strong>{currentTime.timeStr}</strong>
          </>
        ) : (
          <span>로딩 중...</span>
        )}
      </div>
      <div className={styles.mainTop__message}>
        {quoteLoading ? (
          <span>로딩 중...</span>
        ) : quote ? (
          <span>
            {quote.text} - {quote.author}
          </span>
        ) : (
          <span>잃지 마라! 그리고 첫 번째 규칙을 잊지 마라! - 워렌 버핏</span>
        )}
      </div>
    </div>
  )
}
