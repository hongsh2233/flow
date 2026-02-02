'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Tab.module.css'

interface TabItem {
  label: string
  href?: string
  value?: string
}

interface TabListProps {
  variant?: 'tab' | 'menu'
  items: TabItem[]
  activeValue?: string // Tabs에서 주입받음
  setActiveValue?: (val: string) => void // Tabs에서 주입받음
}

export default function TabList({
  variant = 'tab',
  items,
  activeValue,
  setActiveValue,
}: TabListProps) {
  const pathname = usePathname()
  const tabMenuRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement | null>(null)
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null)

  // 활성 탭이 변경되면 항상 스크롤 이동
  useEffect(() => {
    const activeElement = activeTabRef.current || activeLinkRef.current
    if (activeElement && tabMenuRef.current) {
      const tabElement = activeElement
      const menuElement = tabMenuRef.current

      const tabLeft = tabElement.offsetLeft
      const tabWidth = tabElement.offsetWidth
      const menuScrollLeft = menuElement.scrollLeft
      const menuWidth = menuElement.offsetWidth

      // 탭을 중앙에 배치하도록 스크롤 이동
      const targetScrollLeft = tabLeft - (menuWidth / 2) + (tabWidth / 2)
      
      menuElement.scrollTo({
        left: Math.max(0, targetScrollLeft), // 음수 방지
        behavior: 'smooth',
      })
    }
  }, [activeValue, pathname, variant])

  return (
    <div className={styles.tabMenu} ref={tabMenuRef}>
      {items.map((item, index) => {
        const itemValue = item.value || index.toString()

        // 활성화 조건: menu는 URL 비교, tab은 상태값 비교
        const isActive =
          variant === 'menu'
            ? pathname === item.href
            : activeValue === itemValue

        if (variant === 'menu' && item.href) {
          return (
            <Link
              key={index}
              ref={isActive ? activeLinkRef : null}
              href={item.href}
              className={`${styles.tabItem} ${
                isActive ? styles['is-active'] : ''
              }`}
            >
              {item.label}
            </Link>
          )
        }

        return (
          <button
            key={index}
            ref={isActive ? activeTabRef : null}
            type="button"
            className={`${styles.tabItem} ${
              isActive ? styles['is-active'] : ''
            }`}
            onClick={() => setActiveValue?.(itemValue)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
