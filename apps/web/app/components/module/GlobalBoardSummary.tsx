'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchBoardPosts } from '@/lib/services/boardService'
import type { Post } from '@/lib/types/api'
import styles from './GlobalBoardSummary.module.css'

interface GlobalBoardSummaryProps {
  boardId?: string
  maxItems?: number
}

export default function GlobalBoardSummary({
  boardId = 'B004',
  maxItems = 2,
}: GlobalBoardSummaryProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchBoardPosts(boardId, 1, maxItems)
        if (res.success && res.data) {
          // 최대 maxItems개까지만 표시
          setPosts(res.data.slice(0, maxItems))
        } else {
          setPosts([])
        }
      } catch (error) {
        console.error('글로벌 게시판 데이터를 불러오는데 실패했습니다:', error)
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [boardId, maxItems])

  // 날짜 포맷팅 함수 (YYYY-MM-DD 형식)
  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch {
      return dateString.split('T')[0] || ''
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>글로벌 게시판에 게시글이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {posts.map((post) => {
        const postWithSubject = post as Post & { subject?: string }
        const title = postWithSubject.subject || post.title || '제목 없음'
        const date = formatDate(post.created_at || '')
        // 12시간 이내 글인지 확인
        const isNew = post.created_at ? (() => {
          const postDate = new Date(post.created_at)
          const now = new Date()
          const diffHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60)
          return diffHours <= 12
        })() : false

        return (
          <div key={post.id} className={styles.item}>
            <Link href={`/post/${post.id}`} className={styles.link}>
              <h3 className={styles.title}>
                {title}
                {isNew && <span className={styles.newBadge}>NEW</span>}
              </h3>
              <p className={styles.date}>{date}</p>
            </Link>
          </div>
        )
      })}
    </div>
  )
}

