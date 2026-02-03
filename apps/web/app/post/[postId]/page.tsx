'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchPostDetail } from '@/lib/services/boardService'
import type { Post } from '@/lib/types/api'
import PageTitle from '@/app/components/element/PageTitle'
import { API_BASE_URL } from '@/lib/config/api'
import styles from './postDetail.module.css'

// content 내 이미지 경로를 절대 URL로 변환
function processContentImages(content: string, baseUrl: string): string {
  if (!content) return content
  
  // 상대 경로 이미지를 절대 URL로 변환
  // /uploads/... 형태의 경로를 baseUrl + /uploads/... 로 변환
  return content.replace(
    /<img([^>]*?)src=["'](\/uploads\/[^"']+)["']([^>]*?)>/gi,
    (match, before, src, after) => {
      // 이미 절대 URL인 경우는 그대로 유지
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return match
      }
      // 상대 경로인 경우 baseUrl 추가
      const absoluteUrl = baseUrl + src
      return `<img${before}src="${absoluteUrl}"${after}>`
    }
  )
}

interface PostDetail extends Omit<Post, 'views'> {
  board?: {
    id: string
    name: string
    type: string
  }
  views?: number
  attachments?: Array<{
    filename: string
    path: string
    type?: string
    formatted_size?: string
  }>
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.postId as string

  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!postId) {
      setError('게시글 ID가 없습니다.')
      setLoading(false)
      return
    }

    const loadPost = async () => {
      try {
        console.log('게시글 상세 조회 시작, postId:', postId)
        const postData = await fetchPostDetail(postId)
        console.log('게시글 상세 조회 결과:', postData)

        if (postData) {
          // 보안: 게시글 상세 정보는 콘솔에 출력하지 않음
          console.log('=== 프론트엔드 게시글 데이터 설정 ===')
          console.log('postData 로드 완료:', {
            id: postData.id,
            hasAttachments: !!(postData as PostDetail).attachments,
            attachmentsCount: (postData as PostDetail).attachments?.length || 0,
            contentLength: postData.content?.length || 0
          })
          setPost(postData as PostDetail)
          setError(null)
        } else {
          console.warn('게시글 데이터가 null입니다.')
          setError('게시글을 찾을 수 없습니다.')
        }
      } catch (err) {
        console.error('게시글 상세 조회 실패:', err)
        const errorMessage =
          err instanceof Error
            ? err.message
            : '게시글을 불러오는데 실패했습니다.'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadPost()
  }, [postId])

  if (loading) {
    return (
      <div className="content__wrap">
        <div className={styles.loading}>게시글을 불러오는 중...</div>
      </div>
    )
  }

  if (error || !post) {
    const isAuthError = error?.includes('API 키') || error?.includes('인증')
    const isSecretError = error?.includes('비밀글')
    return (
      <div className="content__wrap">
        <div className={styles.error}>
          <p>{error || '게시글을 찾을 수 없습니다.'}</p>
          {isAuthError && (
            <div
              style={{
                marginTop: '15px',
                padding: '15px',
                background: '#fff3cd',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#856404',
              }}
            >
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
                ⚠️ 인증 오류
              </p>
              <p style={{ margin: 0 }}>
                환경 변수 파일(.env.local)에 <code>NEXT_PUBLIC_X_API_KEY</code>
                가 설정되어 있는지 확인해주세요.
              </p>
            </div>
          )}
          {isSecretError && (
            <div
              style={{
                marginTop: '15px',
                padding: '15px',
                background: '#f8d7da',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#721c24',
              }}
            >
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
                🔒 비밀글 접근 제한
              </p>
              <p style={{ margin: 0 }}>
                비밀글은 작성자만 조회할 수 있습니다.
              </p>
            </div>
          )}
          <Link href="/news" className={styles.backLink}>
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="content__wrap">
      <div className={styles.postDetail}>
        {/* 헤더 */}
        <div className={styles.header}>
          {/* <Link href="/news" className={styles.backButton}>
            ← 목록으로
          </Link> */}
          {post.board && (
            <div className={styles.boardName}>{post.board.name}</div>
          )}
        </div>

        {/* 제목 영역 */}
        <div className={styles.titleSection}>
          <h1 className={styles.title}>
            {post.is_secret === 'true' && '🔒 '}
            {post.title || '제목 없음'}
          </h1>
          <div className={styles.meta}>
            <span>작성자: {post.author && post.author.includes('@') ? post.author.split('@')[0] : (post.author || '익명')}</span>
            <span>작성일: {formatDate(post.created_at)}</span>
            {post.views !== undefined && <span>조회수: {post.views}</span>}
            {post.is_secret === 'true' && <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>🔒 비밀글</span>}
          </div>
        </div>

        {/* 본문 영역 */}
        {post.is_secret === 'true' ? (
          <div className={styles.content} style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#888',
            background: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>🔒</p>
            <p>비밀글은 작성자만 조회할 수 있습니다.</p>
          </div>
        ) : (
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ 
              __html: processContentImages(post.content || '', API_BASE_URL) 
            }}
          />
        )}

        {/* 첨부파일 영역 */}
        {post.attachments && post.attachments.length > 0 && (
          <div className={styles.attachments}>
            <h3>첨부파일</h3>
            <ul className={styles.attachmentList}>
              {post.attachments
                .filter((file) => !file.type?.startsWith('image/'))
                .map((file, index) => (
                  <li key={index} className={styles.attachmentItem}>
                    <a
                      href={file.path.startsWith('http') ? file.path : `${API_BASE_URL}${file.path}`}
                      download={file.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.attachmentLink}
                    >
                      📎 {file.filename}
                      {file.formatted_size && (
                        <span className={styles.fileSize}>
                          {' '}
                          ({file.formatted_size})
                        </span>
                      )}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className={styles.footer}>
          <Link href="/news" className={styles.listButton}>
            목록으로
          </Link>
        </div>
      </div>
    </div>
  )
}
