'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import styles from './BottomNav.module.css'
import IconButton from '../element/IconButton'
import { fetchNavMenu } from '@/lib/services/navMenuService'

const DEFAULT_NAV_LIST = [
  { name: '홈', icon: 'icon_home', link: '/' },
  { name: '증시일정', icon: 'icon_calendar', link: '/schedule' },
  { name: '종목자료', icon: 'icon_chat', link: '/stock_info' },
  { name: '시황/뉴스', icon: 'icon_article', link: '/news' },
  { name: '설정', icon: 'icon_setting', link: '/setting' },
]

export default function Header() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [navList, setNavList] = useState<Array<{ name: string; icon: string; link: string }>>(DEFAULT_NAV_LIST)

  useEffect(() => {
    fetchNavMenu().then((items) => {
      setNavList(items.map((item) => ({ name: item.name, icon: item.icon, link: item.link })))
    })
  }, [])

  // 1. 로그인 페이지는 아예 헤더 숨김
  if (pathname === '/login') return null

  // 2. 메인 페이지 여부 확인 변수
  const isMain = pathname === '/'

  // 3. 네비게이션 타이틀 로직 (메인이 아닐 때 사용) - 경로 일치 또는 matchPaths 포함
  const currentNav = navList.find((nav) => nav.link === pathname)
    ?? navList.find((nav) => pathname.startsWith(nav.link) && nav.link !== '/')
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
