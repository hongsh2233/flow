'use client'

import React, { useState, useEffect } from 'react'
import styles from './StockNews.module.css'

interface NewsItem {
  title: string
  originallink: string
  link: string
  description: string
  pubDate: string
}

interface NewsResponse {
  success: boolean
  message: string
  data: NewsItem[]
  total?: number
}

interface StockNewsProps {
  stockName: string
  stockCode: string
  limit?: number
}

export default function StockNews({ stockName, stockCode, limit = 3 }: StockNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = async () => {
    try {
      setLoading(true)
      setError(null)
      // 종목명으로 뉴스 검색
      const query = `${stockName} 주가`
      const response = await fetch(
        `/api/naver-news?query=${encodeURIComponent(query)}&display=${limit}&sort=date`
      )
      const result: NewsResponse = await response.json()

      if (result.success && result.data) {
        setNews(result.data.slice(0, limit))
      } else {
        setError(result.message || '뉴스를 가져오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('뉴스 가져오기 실패:', err)
      setError('뉴스를 가져오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (stockName) {
      fetchNews()
    }
  }, [stockName, limit])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 1) return '방금 전'
      if (minutes < 60) return `${minutes}분 전`
      if (hours < 24) return `${hours}시간 전`
      if (days < 7) return `${days}일 전`

      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className={styles.stockNews__wrap}>
        <div className={styles.stockNews__loading}>뉴스를 불러오는 중...</div>
      </div>
    )
  }

  if (error) {
    return null // 에러 시 표시하지 않음
  }

  if (news.length === 0) {
    return null // 뉴스가 없으면 표시하지 않음
  }

  const getHostname = (originallink: string, fallbackLink: string) => {
    const target = originallink || fallbackLink
    if (!target) return ''

    try {
      // 프로토콜이 없으면 기본적으로 https를 붙여서 파싱을 시도
      const url = target.startsWith('http') ? new URL(target) : new URL(`https://${target}`)
      return url.hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  return (
    <div className={styles.stockNews__wrap}>
      <div className={styles.stockNews__header}>
        <h3 className={styles.stockNews__title}>{stockName} 관련 뉴스</h3>
      </div>
      <div className={styles.stockNews__list}>
        {news.map((item, index) => (
          <a
            key={index}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.stockNews__item}
          >
            <h4 className={styles.stockNews__itemTitle}>{item.title}</h4>
            <div className={styles.stockNews__itemMeta}>
              <span className={styles.stockNews__itemDate}>
                {formatDate(item.pubDate)}
              </span>
              <span className={styles.stockNews__itemSource}>
                {getHostname(item.originallink, item.link) || '뉴스'}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

