'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import styles from './BottomNav.module.css'
import Icon from './Icon'

// 1. 각 아이템의 타입을 정의합니다.
interface NavItem {
  name: string
  link: string
  icon?: string // 아이콘 파일명 (예: 'icon_home')
  matchPaths?: string[] // 이 메뉴를 활성화할 경로 패턴들
}

// 2. Props의 타입을 정의합니다.
interface NaviListProps {
  navList: NavItem[]
}

// 3. 경로 매칭 함수 (query string 포함)
function isPathActive(pathname: string, searchParams: URLSearchParams, item: NavItem): boolean {
  // link에서 pathname과 query string 추출
  const itemLink = item.link.split('?')[0]
  const itemQuery = item.link.includes('?') ? item.link.split('?')[1] : ''
  const currentQuery = searchParams.toString()

  // 정확히 일치하는 경우 (pathname + query string)
  if (pathname === itemLink && itemQuery === currentQuery) return true

  // matchPaths가 있으면 그것을 우선 체크
  if (item.matchPaths && item.matchPaths.length > 0) {
    return item.matchPaths.some(path => {
      const matchPath = path.split('?')[0]
      const matchQuery = path.includes('?') ? path.split('?')[1] : ''
      
      // pathname과 query string 모두 일치
      if (pathname === matchPath && matchQuery === currentQuery) return true
      
      // query string이 없는 경우 pathname만 비교
      if (!matchQuery && pathname === matchPath && !currentQuery) return true
      
      // 하위 경로 매칭 (예: /news/detail, /post/123) - query string 무시
      if (pathname.startsWith(matchPath + '/')) return true
      return false
    })
  }

  // matchPaths가 없으면 기본 동작: 링크로 시작하는지 체크
  // 단, 홈("/")은 정확히 일치해야만 활성화
  if (item.link === '/') {
    return pathname === '/' && !currentQuery
  }

  // query string이 있는 경우 정확히 일치해야 함
  if (itemQuery) {
    return pathname === itemLink && itemQuery === currentQuery
  }

  // query string이 없는 경우 pathname만 비교
  return (pathname.startsWith(itemLink + '/') || pathname === itemLink) && !currentQuery
}

// 4. 컴포넌트에 타입을 적용합니다.
export default function NaviList({ navList }: NaviListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <ul className={styles.naviList}>
      {navList.map((item, index) => {
        const isActive = isPathActive(pathname, searchParams, item)
        return (
          <li key={index} className={isActive ? styles['is-active'] : ''}>
            <Link href={item.link}>
              {/* 아이콘이 있을 때만 렌더링하도록 조건부 처리 */}
              {item.icon && (
                <span>
                  <Icon name={item.icon} width={24} height={24} />
                </span>
              )}
              <span>{item.name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
