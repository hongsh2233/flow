/**
 * API 타입 정의
 */

/**
 * 메인 페이지 아이템 타입
 */
export interface MainPageItem {
  id: number
  name: string
  component_key: string
  order_index: number
  is_visible: string
  start_date?: string | null // 노출 시작일시 (YYYY-MM-DD HH:MM 형식)
  end_date?: string | null // 노출 종료일시 (YYYY-MM-DD HH:MM 형식)
  repeat_type?: string | null // 반복 타입 ('none', 'daily', 'weekly')
  repeat_days?: string | null // 주간 반복 요일 (예: "1,3,5")
  repeat_start_time?: string | null // 반복 시작 시간 (HH:MM)
  repeat_end_time?: string | null // 반복 종료 시간 (HH:MM)
  repeat_next_day?: string | null // 익일까지 반복 여부 ('true', 'false')
}

/**
 * API 응답 기본 구조
 */
export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

/**
 * 메인 페이지 설정 응답
 */
export interface MainPageConfigResponse {
  success: boolean
  message: string
  items: MainPageItem[]
}

/**
 * 게시글 타입
 */
export interface Post {
  id: number
  board_id: string
  title: string
  content?: string
  author: string
  views: number
  is_secret?: string
  created_at: string
  updated_at?: string
  attachments?: Attachment[]
}

/**
 * 첨부파일 타입
 */
export interface Attachment {
  filename: string
  path: string
  type?: string
  formatted_size?: string
}

/**
 * 게시판 타입
 */
export interface Board {
  id: string
  name: string
  type: string
  description?: string
  auth?: string
  created_at?: string
  updated_at?: string
  post_count?: number
}

/**
 * 일정 타입
 */
export interface Schedule {
  id: number
  date: string
  subject: string
  content?: string
  type?: string
  created_at?: string
  updated_at?: string
}

/**
 * 캐릭터 정보 타입
 */
export interface CharacterInfo {
  id: number
  name: string
  image: string
  description?: string
}

/**
 * KRX 데이터 타입
 */
export interface KrxData {
  bas_dd?: string
  BAS_DD?: string
  [key: string]: any
}

/**
 * FSC 주가 데이터 타입
 */
export interface FscStockPrice {
  srtn_cd?: string
  itms_nm?: string
  clpr?: string
  vs?: string
  flt_rt?: string
  bas_dt?: string
  [key: string]: any
}

/**
 * 수집 데이터 타입
 */
export interface CollectedData {
  id: number
  data_type: string
  data_content: any
  created_at: string
}

/**
 * 우측 일정 아이템 타입 (권리행사일정 API 응답 - 동적 키 지원)
 */
export interface RightScheduleItem extends Record<string, string | undefined> {
  date?: string
  subject?: string
  content?: string
}

/**
 * 재무제표 타입
 */
export type FinaStatType = 'summ' | 'bs' | 'inco'

/**
 * 휴일 타입
 */
export interface Holiday {
  date: string
  name: string
  is_national?: boolean
}

