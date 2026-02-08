'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { fetchNavMenu } from '@/lib/services/navMenuService'
import type { NavMenuTabItem } from '@/lib/services/navMenuService'

const DEFAULT_NEWS_TABS: NavMenuTabItem[] = [
  { label: '전체뉴스', href: '/news' },
  { label: '관심뉴스', href: '/news?tab=favorite' },
]

/**
 * 현재 경로에 해당하는 메뉴의 서브 메뉴(탭) 목록을 반환합니다.
 * API에서 가져온 메뉴 중 matchPaths 또는 link가 pathname과 일치하는 항목의 tabs를 사용하고,
 * query string도 고려합니다.
 */
export function useNavTabs(): { tabs: NavMenuTabItem[]; isLoading: boolean } {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tabs, setTabs] = useState<NavMenuTabItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setTabs([])
    setIsLoading(true)

    const currentQuery = searchParams.toString()
    const currentPath = pathname + (currentQuery ? `?${currentQuery}` : '')

    fetchNavMenu().then((items) => {
      if (cancelled) return
      
      // query string을 고려하여 메뉴 찾기
      const item = items.find((nav) => {
        // 정확히 일치하는 경우
        if (nav.link === currentPath) return true
        
        // pathname만 일치하는 경우
        if (nav.link === pathname) return true
        
        // matchPaths 확인 (query string 포함)
        if (nav.matchPaths && nav.matchPaths.length > 0) {
          return nav.matchPaths.some((p) => {
            // 정확히 일치
            if (p === currentPath) return true
            // pathname만 일치 (query string 없는 경우)
            if (p === pathname && !currentQuery) return true
            // pathname으로 시작하는 경우 (하위 경로)
            if (p !== '/' && pathname.startsWith(p.split('?')[0])) return true
            return false
          })
        }
        
        return false
      })
      
      if (item?.tabs && item.tabs.length > 0) {
        // href를 /board?로 변환 (게시판 탭인 경우)
        const convertedTabs = item.tabs.map(tab => ({
          ...tab,
          href: tab.href.includes('/news?board=') 
            ? tab.href.replace('/news?board=', '/board?board=')
            : tab.href
        }))
        setTabs(convertedTabs)
      } else if (
        pathname === '/news' ||
        pathname === '/report' ||
        pathname === '/global' ||
        pathname === '/disclosure'
      ) {
        setTabs(DEFAULT_NEWS_TABS)
      } else {
        setTabs([])
      }
      setIsLoading(false)
    }).catch(() => {
      if (!cancelled) {
        if (
          pathname === '/news' ||
          pathname === '/report' ||
          pathname === '/global' ||
          pathname === '/disclosure'
        ) {
          setTabs(DEFAULT_NEWS_TABS)
        } else {
          setTabs([])
        }
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [pathname, searchParams])

  return { tabs, isLoading }
}
