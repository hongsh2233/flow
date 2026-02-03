'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'
import NaviList from './NaviList'
import { fetchNavMenu } from '@/lib/services/navMenuService'

export default function BottomNav() {
  const pathname = usePathname()
  const [navList, setNavList] = useState<Array<{ name: string; icon: string; link: string; matchPaths: string[] }>>([])

  useEffect(() => {
    fetchNavMenu().then((items) => {
      setNavList(
        items.map((item) => ({
          name: item.name,
          icon: item.icon,
          link: item.link,
          matchPaths: item.matchPaths?.length ? item.matchPaths : [item.link],
        }))
      )
    })
  }, [])

  if (pathname === '/login') return null
  if (navList.length === 0) return null

  return (
    <div className={styles.bottomWrap}>
      <NaviList navList={navList} />
    </div>
  )
}
