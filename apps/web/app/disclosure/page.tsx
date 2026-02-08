'use client'

import React, { Suspense } from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import NaverNews from '../components/module/NaverNews'
import { useNavTabs } from '../hooks/useNavTabs'

const DEFAULT_TABS = [  
  { label: '뉴스', href: '/disclosure' },
  { label: '관심뉴스', href: '/favoriteNews' },
]

function DisclosureContent() {
  const { tabs, isLoading } = useNavTabs()
  const menuData = tabs.length > 0 ? tabs.map((t) => ({ label: t.label, href: t.href })) : (isLoading ? DEFAULT_TABS : DEFAULT_TABS)

  return (
    <div className="content__wrap">
      <PageTitle label="금융/주식 뉴스" />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={menuData} variant="menu" />
        </Suspense>
      </Tabs>
      <NaverNews />
    </div>
  )
}

export default function DisclosurePage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="금융/주식 뉴스" /></div>}>
      <DisclosureContent />
    </Suspense>
  )
}
