'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchBoardPosts } from '@/lib/services/boardService'
import type { Post } from '@/lib/types/api'
import styles from './Board.module.css'

interface BoardProps {
  boardId: string
  emptyMessage?: string
}

export default function Board({ boardId, emptyMessage = '등록된 게시글이 없습니다.' }: BoardProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchBoardPosts(boardId)
        if (res.success && res.data) {
          setPosts(res.data)
          setError(null)
        } else {
          setError(res.message || '데이터를 불러오는데 실패했습니다.')
          setPosts([])
        }
      } catch (error) {
        console.error('게시판 데이터를 불러오는데 실패했습니다:', error)
        setError('데이터를 불러오는데 실패했습니다.')
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [boardId])

  if (loading) {
    return <div className={styles.board__wrap}>데이터 로딩 중...</div>
  }

  return (
    <div className={styles.listtype__board}>
      {error ? (
        <div className={styles.board__items}>
          <p style={{ color: 'red' }}>{error}</p>
          <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
            .env.local 파일에 NEXT_PUBLIC_X_API_KEY를 설정해주세요.
          </p>
        </div>
      ) : posts.length > 0 ? (
        posts.map((post) => {
          const postWithSubject = post as Post & { subject?: string }
          // 12시간 이내 글인지 확인
          const isNew = post.created_at ? (() => {
            const postDate = new Date(post.created_at)
            const now = new Date()
            const diffHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60)
            return diffHours <= 12
          })() : false
          
          const isSecret = post.is_secret === 'true'
          
          return (
            <div key={post.id} className={styles.board__inner}>
              <Link href={`/post/${post.id}`}>
                <h3 className={styles.board__title__h3}>
                  {isSecret ? '🔒 ' : ''}
                  {isSecret ? '비밀글' : (postWithSubject.subject || post.title || '제목 없음')}
                  {isNew && <span className={styles.newBadge}>NEW</span>}
                </h3>
                <p className={styles.board__info}>
                  작성일:{' '}
                  {post.created_at ? post.created_at.split('T')[0] : '2026-01-07'}
                </p>
              </Link>
            </div>
          )
        })
      ) : (
        <div className={styles.board__inner}>{emptyMessage}</div>
      )}
    </div>
  )
}
