'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import styles from './BottomNav.module.css'
import IconButton from '../element/IconButton'
import { fetchNavMenu } from '@/lib/services/navMenuService'

function HeaderContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navList, setNavList] = useState<Array<{ name: string; icon: string; link: string; matchPaths?: string[] }>>([])

  useEffect(() => {
    fetchNavMenu().then((items) => {
      setNavList(items.map((item) => ({ 
        name: item.name, 
        icon: item.icon, 
        link: item.link,
        matchPaths: item.matchPaths 
      })))
    }).catch((error) => {
      console.error('메뉴 로딩 실패:', error)
      // 에러 발생 시 빈 배열 유지 (fallback 없음)
    })
  }, [])

  // 1. 로그인 페이지는 아예 헤더 숨김
  if (pathname === '/login') return null

  // 2. 메인 페이지 여부 확인 변수
  const isMain = pathname === '/'

  // 3. 네비게이션 타이틀 로직 (메인이 아닐 때 사용) - 경로 일치 또는 matchPaths 포함 (query string 고려)
  const currentQuery = searchParams.toString()
  const currentNav = navList.length > 0 ? navList.find((nav) => {
    const navLink = nav.link.split('?')[0]
    const navQuery = nav.link.includes('?') ? nav.link.split('?')[1] : ''
    // 정확히 일치하는 경우
    if (pathname === navLink && navQuery === currentQuery) return true
    
    // matchPaths 확인
    if (nav.matchPaths && nav.matchPaths.length > 0) {
      return nav.matchPaths.some(path => {
        const matchPath = path.split('?')[0]
        const matchQuery = path.includes('?') ? path.split('?')[1] : ''
        return pathname === matchPath && matchQuery === currentQuery
      })
    }
    
    // 기본 매칭 (query string이 없는 경우)
    if (!navQuery && !currentQuery && pathname.startsWith(navLink) && navLink !== '/') return true
    return false
  }) ?? navList.find((nav) => {
    const navLink = nav.link.split('?')[0]
    return pathname.startsWith(navLink) && navLink !== '/' && !searchParams.toString()
  }) : null
  const subPageTitle = currentNav?.name || '증시 정보'

  const handleBack = () => router.back()
  const handleLogin = () => router.push('/login')
  const handleSetting = () => router.push('/setting')

  return (
    <div className={styles.header__wrap}>
      {/* [뒤로가기 버튼] 
        메인 페이지(isMain)가 아닐 때만(!isMain) 렌더링 
      */}
      {!isMain && (
        <IconButton
          iconName="icon_back"
          onClick={handleBack}
          label="뒤로"
          className="btn-outline-back"
        />
      )}

      {/* [타이틀] 
        isMain이면 -> '주린이 탈출' (가운데 정렬 클래스)
        아니면 -> 해당 페이지 이름 (일반 클래스)
      */}
      <h1 className={isMain ? styles.header__title_center : 'header__title'}>
        {isMain ? '주린이 탈출' : subPageTitle}
      </h1>

      {/* [우측 버튼: 로그인/설정]
        메인 페이지에서도 로그인/설정 접근은 필요하므로 유지했습니다.
      */}
      {session ? (
        <IconButton
          iconName="icon_account2"
          onClick={handleSetting}
          label="설정"
          className="btn-member"
        />
      ) : (
        <IconButton
          iconName="icon_login"
          onClick={handleLogin}
          label="로그인"
          className="btn-member"
        />
      )}
    </div>
  )
}

export default function Header() {
  return (
    <Suspense fallback={
      <div className={styles.header__wrap}>
        <h1 className={styles.header__title_center}>주린이 탈출</h1>
      </div>
    }>
      <HeaderContent />
    </Suspense>
  )
}
