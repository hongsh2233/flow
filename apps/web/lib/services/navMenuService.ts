/**
 * 하단/헤더 메뉴 API
 * admin 설정에서 관리한 메뉴를 조회합니다.
 */

import { API_BASE_URL } from '@/lib/config/api'

export interface NavMenuTabItem {
  label: string
  href: string
}

export interface NavMenuItem {
  id: number
  name: string
  icon: string
  link: string
  matchPaths: string[]
  tabs?: NavMenuTabItem[]
}

const DEFAULT_NAV_LIST: NavMenuItem[] = [
  { id: 0, name: '홈', icon: 'icon_home', link: '/', matchPaths: ['/'] },
  { id: 1, name: '증시일정', icon: 'icon_calendar', link: '/schedule', matchPaths: ['/schedule'] },
  { id: 2, name: '종목자료', icon: 'icon_chat', link: '/stock_info', matchPaths: ['/stock_info'] },
  { id: 3, name: '시황/뉴스', icon: 'icon_article', link: '/news', matchPaths: ['/news', '/report', '/global', '/disclosure', '/post'] },
  { id: 4, name: '설정', icon: 'icon_setting', link: '/setting', matchPaths: ['/setting'] },
]

/**
 * 하단/헤더 메뉴 목록 조회 (API 실패 시 기본 목록 반환)
 */
export async function fetchNavMenu(): Promise<NavMenuItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/nav-menu`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return DEFAULT_NAV_LIST
    const json = await res.json()
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data as NavMenuItem[]
    }
    return DEFAULT_NAV_LIST
  } catch {
    return DEFAULT_NAV_LIST
  }
}
