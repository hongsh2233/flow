'use client'

import React, { useState, useEffect } from 'react'
import { formatRelativeDate } from '@/lib/utils/formatting'
import styles from './NewsList.module.css'

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

interface NewsListProps {
  query: string
  limit?: number
  title?: string
  hideOnError?: boolean
  hideOnEmpty?: boolean
}

export default function NewsList({
  query,
  limit = 50,
  title,
  hideOnError = false,
  hideOnEmpty = false,
}: NewsListProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = async () => {
    try {
      setLoading(true)
      setError(null)
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
    if (query) {
      fetchNews()
    }
  }, [query, limit])

  if (loading) {
    return (
      <div className={styles.news__wrap}>
        <div className={styles.news__loading}>뉴스를 불러오는 중...</div>
      </div>
    )
  }

  if (error) {
    if (hideOnError) return null
    return (
      <div className={styles.news__wrap}>
        <div className={styles.news__error}>{error}</div>
      </div>
    )
  }

  if (news.length === 0) {
    if (hideOnEmpty) return null
    return (
      <div className={styles.news__wrap}>
        <div className={styles.news__empty}>뉴스가 없습니다.</div>
      </div>
    )
  }

  return (
    <div className={styles.news__wrap}>
      {title && (
        <div className={styles.news__header}>
          <h2 className={styles.news__title}>{title}</h2>
        </div>
      )}
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
                {formatRelativeDate(item.pubDate)}
              </span>
              <span className={styles.news__itemSource}>
                {new URL(item.originallink).hostname.replace('www.', '')}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
