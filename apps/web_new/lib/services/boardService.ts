/**
 * 게시판 서비스
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

import type {
  ApiResponse,
  PaginatedResponse,
  Board,
  PostFromApi,
  BoardListItem,
  BoardPost,
} from '@/lib/types/board'
import { API_BASE_URL } from '@/lib/config/api'

// ── 시간 포맷 유틸 ──

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/**
 * 작성자 이름 포맷팅
 * 이메일 형식인 경우 @ 앞부분만 표시하여 이메일 노출 방지
 */
function formatAuthorName(author: string | null | undefined): string {
  if (!author) return '익명'
  if (author.includes('@')) {
    return author.split('@')[0]
  }
  return author
}

/**
 * HTML 콘텐츠 내 /uploads/ 상대 경로를 API 서버 절대 경로로 변환
 * 에디터에서 삽입된 이미지가 프론트엔드에서 정상 표시되도록 처리
 */
function rewriteUploadUrls(html: string): string {
  if (!html) return html
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  // src="/uploads/..." 또는 href="/uploads/..." 패턴을 절대 경로로 변환
  return html.replace(
    /(src|href)=(["'])(\/uploads\/)/g,
    `$1=$2${baseUrl}$3`
  )
}

// ── API → UI 변환 ──

export function postToListItem(post: PostFromApi): BoardListItem {
  const plainContent = stripHtml(post.content || '')
  return {
    id: post.id,
    title: post.title,
    summary: plainContent.length > 80 ? plainContent.slice(0, 80) + '...' : plainContent,
    author: formatAuthorName(post.author),
    time: formatTimeAgo(post.created_at),
    views: post.views || 0,
    category: post.category || null,
    tag: null,
  }
}

export function postToDetail(post: PostFromApi): BoardPost {
  return {
    id: post.id,
    title: post.title,
    tag: null,
    author: formatAuthorName(post.author),
    time: formatTimeAgo(post.created_at),
    views: post.views || 0,
    category: post.category || null,
    content: rewriteUploadUrls(post.content),
    boardName: post.board?.name,
    attachments: post.attachments,
  }
}

// ── API 호출 함수 ──

/**
 * 게시판 목록 조회
 */
export async function fetchBoards(): Promise<ApiResponse<Board[]>> {
  try {
    const response = await fetch('/api/boards', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 500) {
        return { success: true, data: [] }
      }
      return { success: false, message: '게시판 목록을 불러올 수 없습니다.' }
    }

    const data = await response.json()
    return { success: true, data: data.data ?? [] }
  } catch (error) {
    console.error('게시판 목록 조회 오류:', error)
    return { success: true, data: [] }
  }
}

/**
 * 게시판의 게시글 목록 조회
 */
export async function fetchBoardPosts(
  boardId: string,
  page = 1,
  limit = 10
): Promise<PaginatedResponse<PostFromApi[]>> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    const response = await fetch(`/api/boards/${boardId}/posts?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      if (response.status === 404 || response.status === 401) {
        return { success: true, data: [], pagination: { page: 1, limit, total_count: 0, total_pages: 0 } }
      }
      return { success: false, message: '게시글 목록을 불러올 수 없습니다.', data: [] }
    }

    const data = await response.json()
    return {
      success: true,
      data: data.data ?? [],
      pagination: data.pagination,
    }
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error)
    return { success: false, message: '게시글 목록을 불러오는데 실패했습니다.', data: [] }
  }
}

/**
 * 게시글 상세 조회
 */
export async function fetchPostDetail(postId: number | string): Promise<PostFromApi | null> {
  try {
    const response = await fetch(`/api/posts/${postId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) return null

    const data = await response.json()
    const post = data.data ?? data
    if (!post || typeof post !== 'object') return null
    return post as PostFromApi
  } catch (error) {
    console.error('게시글 상세 조회 오류:', error)
    return null
  }
}
