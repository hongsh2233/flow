'use client'

import React, { Suspense } from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import Board from '../components/module/Board'
import { useNavTabs } from '../hooks/useNavTabs'

const DEFAULT_TABS = [
  { label: '시황', href: '/board?board=B001' },
  { label: '리포트', href: '/report' },
  { label: '글로벌', href: '/global' },
  { label: '뉴스', href: '/disclosure' },
]

function GlobalContent() {
  const { tabs, isLoading } = useNavTabs()
  const menuData = tabs.length > 0 ? tabs.map((t) => ({ label: t.label, href: t.href })) : (isLoading ? DEFAULT_TABS : DEFAULT_TABS)

  return (
    <div className="content__wrap">
      <PageTitle label="시황자료" />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={menuData} variant="menu" />
        </Suspense>
      </Tabs>
      <Board boardId="B004" />
    </div>
  )
}

export default function GlobalPage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="시황자료" /></div>}>
      <GlobalContent />
    </Suspense>
  )
}

