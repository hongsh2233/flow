/**
 * 게시판 서비스
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

import type { ApiResponse, Board, Post } from '@/lib/types/api'

export interface PostDetail extends Omit<Post, 'views'> {
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
      const errorText = await response.text().catch(() => 'Unknown error')
      if (response.status === 401 || response.status === 500) {
        return { success: true, data: [] }
      }
      return {
        success: false,
        message: '게시판 목록을 불러올 수 없습니다.',
        error: errorText,
      }
    }

    const data = await response.json()
    if (data.data) {
      return { success: true, data: data.data }
    }
    if (Array.isArray(data)) {
      return { success: true, data }
    }
    return {
      success: false,
      message: data.message || '게시판 목록 형식이 올바르지 않습니다.',
    }
  } catch (error) {
    console.error('게시판 목록 조회 오류:', error)
    return { success: true, data: [] }
  }
}

/**
 * 게시판의 게시글 목록 조회
 * @param boardId 게시판 ID
 * @param page 페이지 번호 (기본 1)
 * @param limit 페이지당 개수 (기본 10)
 */
export async function fetchBoardPosts(
  boardId: string,
  page = 1,
  limit = 10
): Promise<ApiResponse<Post[]>> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    const response = await fetch(
      `/api/boards/${boardId}/posts?${params}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      // 404(게시판 없음), 401(인증) 등 → 빈 목록으로 처리해 UI 정상 표시
      if (response.status === 404 || response.status === 401) {
        return { success: true, data: [], message: '' }
      }
      return {
        success: false,
        message: '게시글 목록을 불러올 수 없습니다.',
        error: errorText,
        data: [],
      }
    }

    const data = await response.json()
    const posts: Post[] = data.data ?? data.posts ?? (Array.isArray(data) ? data : [])
    return { success: true, data: posts }
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : '게시글 목록을 불러오는데 실패했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
    }
  }
}

/**
 * 게시글 상세 조회
 * @param postId 게시글 ID
 */
export async function fetchPostDetail(postId: string): Promise<PostDetail | null> {
  try {
    const response = await fetch(`/api/posts/${postId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`게시글 상세 조회 오류 (${response.status}):`, errorText)
      return null
    }

    const data = await response.json()
    const post = data.data ?? data
    if (!post || typeof post !== 'object') return null
    return post as PostDetail
  } catch (error) {
    console.error('게시글 상세 조회 오류:', error)
    return null
  }
}
