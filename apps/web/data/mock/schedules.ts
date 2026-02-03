import type { Schedule } from '@/lib/types/api'

export const mockSchedules: Schedule[] = [
  {
    id: 1,
    subject: '코스피 장 시작',
    date: '2026-01-05',
    type: 'api',
    content: '코스피 장 시작 시간',
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
  },
  {
    id: 2,
    subject: '코스피 장 마감',
    date: '2026-01-05',
    type: 'api',
    content: '코스피 장 마감 시간',
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
  },
  {
    id: 3,
    subject: '수동 등록 일정',
    date: '2026-01-10',
    type: 'manual',
    content: '중요 일정',
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
  },
]

