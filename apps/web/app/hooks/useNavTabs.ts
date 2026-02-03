'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { fetchNavMenu } from '@/lib/services/navMenuService'
import type { NavMenuTabItem } from '@/lib/services/navMenuService'

const DEFAULT_NEWS_TABS: NavMenuTabItem[] = [
  { label: '시황', href: '/news' },
  { label: '리포트', href: '/report' },
  { label: '글로벌', href: '/global' },
  { label: '뉴스', href: '/disclosure' },
]

/**
 * 현재 경로에 해당하는 메뉴의 서브 메뉴(탭) 목록을 반환합니다.
 * API에서 가져온 메뉴 중 matchPaths 또는 link가 pathname과 일치하는 항목의 tabs를 사용하고,
 * 없으면 시황/뉴스 계열 페이지일 때 기본 탭을 반환합니다.
 */
export function useNavTabs(): { tabs: NavMenuTabItem[]; isLoading: boolean } {
  const pathname = usePathname()
  const [tabs, setTabs] = useState<NavMenuTabItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setTabs([])
    setIsLoading(true)

    fetchNavMenu().then((items) => {
      if (cancelled) return
      const item = items.find(
        (nav) =>
          nav.link === pathname ||
          (nav.matchPaths && nav.matchPaths.some((p) => p === pathname || (p !== '/' && pathname.startsWith(p))))
      )
      if (item?.tabs && item.tabs.length > 0) {
        setTabs(item.tabs)
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
  }, [pathname])

  return { tabs, isLoading }
}
