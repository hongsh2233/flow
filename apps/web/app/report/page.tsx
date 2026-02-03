'use client'

import * as React from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import TabCont from '../components/element/tabsUi/TabCont'
import Board from '../components/module/Board'
import { useNavTabs } from '../hooks/useNavTabs'

const DEFAULT_TABS = [
  { label: '시황', href: '/news' },
  { label: '리포트', href: '/report' },
  { label: '글로벌', href: '/global' },
  { label: '뉴스', href: '/disclosure' },
]

export default function ReportPage() {
  const { tabs, isLoading } = useNavTabs()
  const menuData = tabs.length > 0 ? tabs.map((t) => ({ label: t.label, href: t.href })) : (isLoading ? DEFAULT_TABS : DEFAULT_TABS)

  return (
    <div className="content__wrap">
      <PageTitle label="시황자료" />
      <Tabs>
        <TabList items={menuData} variant="menu" />
      </Tabs>
      <Board boardId="B003" />
    </div>
  )
}
