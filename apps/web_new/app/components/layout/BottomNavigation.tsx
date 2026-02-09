// @ts-nocheck
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navItems } from '@/config/nav'
import styles from './BottomNav.module.css'

export function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.id}
              href={item.href}
              className={isActive ? `${styles.link} ${styles.linkActive}` : styles.link}
            >
              <span className={styles.icon}><Icon fontSize="small" /></span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavigation
