import type { Board, Post } from '@/lib/types/api'

export const mockBoards: Board[] = [
  {
    id: 'B001',
    name: '공지사항',
    type: 'korean',
    auth: 'all',
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
    post_count: 10,
  },
  {
    id: 'B002',
    name: '시황자료',
    type: 'korean',
    auth: 'all',
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
    post_count: 5,
  },
]

export const mockPosts: Post[] = [
  {
    id: 1,
    board_id: 'B001',
    title: '2026년 1월 2일 시황 분선',
    content: '내용 등록하자내용 등록하자내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자',
    author: '관리자',
    views: 0,
    created_at: '2026-01-02T00:00:00',
    updated_at: '2026-01-02T00:00:00',
  },
  {
    id: 2,
    board_id: 'B001',
    title: '2026년 1월 1일 시황 분선',
    content: '내용 등록하자내용 등록하자내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자 내용 등록하자',
    author: '관리자',
    views: 0,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  },
]

