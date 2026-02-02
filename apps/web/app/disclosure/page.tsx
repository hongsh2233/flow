'use client'

import * as React from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import NaverNews from '../components/module/NaverNews'

export default function DisclosurePage() {
  const menuData = [
    { label: '시황', href: '/news' },
    { label: '리포트', href: '/report' },
    { label: '글로벌', href: '/global' },
    { label: '뉴스', href: '/disclosure' },
  ]

  return (
    <div className="content__wrap">
      <PageTitle label="금융/주식 뉴스" />
      <Tabs>
        <TabList items={menuData} variant="menu" />
      </Tabs>
      <NaverNews />
    </div>
  )
}
