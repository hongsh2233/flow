'use client'

import React, { useState, useEffect, useCallback } from 'react'
import styles from './NaverNews.module.css'

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

const CATEGORIES = [
  { key: 'economy', label: '경제', query: '경제' },
  { key: 'world', label: '세계', query: '세계' },
] as const

type CategoryKey = (typeof CATEGORIES)[number]['key']

export default function NaverNews() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('economy')
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = useCallback(async (category: CategoryKey) => {
    try {
      setLoading(true)
      setError(null)
      const categoryConfig = CATEGORIES.find((c) => c.key === category)!
      const response = await fetch(`/api/naver-news?query=${encodeURIComponent(categoryConfig.query)}&display=50&sort=date`)
      const result: NewsResponse = await response.json()

      if (result.success && result.data) {
        setNews(result.data)
        console.log(`[${categoryConfig.label}] 뉴스 ${result.data.length}개를 가져왔습니다. (전체: ${result.total || 'N/A'})`)
      } else {
        setError(result.message || '뉴스를 가져오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('뉴스 가져오기 실패:', err)
      setError('뉴스를 가져오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews(activeCategory)
  }, [activeCategory, fetchNews])

  const handleCategoryChange = (category: CategoryKey) => {
    if (category !== activeCategory) {
      setActiveCategory(category)
    }
  }

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

  return (
    <div className={styles.news__wrap}>
      <div className={styles.news__header}>
        <h2 className={styles.news__title}>뉴스</h2>
        <div className={styles.news__tabs}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`${styles.news__tab} ${activeCategory === cat.key ? styles['news__tab--active'] : ''}`}
              onClick={() => handleCategoryChange(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className={styles.news__loading}>뉴스를 불러오는 중...</div>
      )}

      {error && (
        <div className={styles.news__error}>{error}</div>
      )}

      {!loading && !error && news.length === 0 && (
        <div className={styles.news__empty}>뉴스가 없습니다.</div>
      )}

      {!loading && !error && news.length > 0 && (
        <div className={styles.news__list}>
          {news.map((item, index) => (
            <a
              key={index}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.news__item}
            >
              <h3 className={styles.news__itemTitle}>{item.title}</h3>
              <div className={styles.news__itemMeta}>
                <span className={styles.news__itemDate}>
                  {formatDate(item.pubDate)}
                </span>
                <span className={styles.news__itemSource}>
                  {new URL(item.originallink).hostname}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
