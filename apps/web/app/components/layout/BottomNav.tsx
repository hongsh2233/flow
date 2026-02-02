'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'
import NaviList from './NaviList'

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  if (pathname === '/login') return null

  const navList = [
    {
      name: '홈',
      icon: 'icon_home',
      link: '/',
      matchPaths: ['/'], // 홈은 정확히 일치만
    },
    {
      name: '증시일정',
      icon: 'icon_calendar',
      link: '/schedule',
      matchPaths: ['/schedule'], // 증시일정 및 하위 페이지
    },
    {
      name: '종목자료',
      icon: 'icon_chat',
      link: '/stock_info',
      matchPaths: ['/stock_info'], // 종목자료 및 하위 페이지
    },
    {
      name: '시황/뉴스',
      icon: 'icon_article',
      link: '/news',
      matchPaths: ['/news', '/report', '/global', '/disclosure', '/post'], // 시황 관련 모든 페이지
    },
    {
      name: '설정',
      icon: 'icon_setting',
      link: '/setting',
      matchPaths: ['/setting'], // 설정 및 하위 페이지
    },
  ]

  return (
    <div className={styles.bottomWrap}>
      <NaviList navList={navList} />
    </div>
  )
}
