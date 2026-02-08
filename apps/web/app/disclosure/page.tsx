'use client'

import React, { Suspense } from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import NaverNews from '../components/module/NaverNews'
import { useNavTabs } from '../hooks/useNavTabs'

function DisclosureContent() {
  const { tabs } = useNavTabs()
  const menuData = tabs.length > 0 ? tabs.map((t) => ({ label: t.label, href: t.href })) : []

  return (
    <div className="content__wrap">
      <PageTitle label="금융/주식 뉴스" />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={menuData} variant="tab" />
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
