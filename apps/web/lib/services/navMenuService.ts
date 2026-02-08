/**
 * 하단/헤더 메뉴 API
 * Next.js API route를 통해 admin 서버로 프록시 (CORS 문제 방지)
 */

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
  { id: 1, name: '캘린더', icon: 'icon_calendar', link: '/schedule', matchPaths: ['/schedule'] },
  { id: 2, name: '뉴스', icon: 'icon_article', link: '/news', matchPaths: ['/news', '/report', '/global', '/disclosure', '/post'] },
  { id: 3, name: '시황자료', icon: 'icon_report', link: '/board?board=B001', matchPaths: ['/board?board=B001', '/board?board=B001&tab=market', '/board?board=B002&tab=study', '/board?board=B002', '/board?board=B002&tab=market', '/board?board=B002&tab=study'] },
  { id: 4, name: '종목자료', icon: 'icon_chat', link: '/stock_info', matchPaths: ['/stock_info'] },
  { id: 5, name: '설정', icon: 'icon_setting', link: '/setting', matchPaths: ['/setting'] },
]

/**
 * 하단/헤더 메뉴 목록 조회 (API 실패 시 기본 목록 반환)
 */
export async function fetchNavMenu(): Promise<NavMenuItem[]> {
  try {
    const res = await fetch('/api/nav-menu', {
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
