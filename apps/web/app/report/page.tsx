'use client'

import React, { Suspense, useEffect, useState } from 'react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import Board from '../components/module/Board'
import { useNavTabs } from '../hooks/useNavTabs'
import { fetchNavMenu } from '@/lib/services/navMenuService'

function ReportContent() {
  const { tabs, isLoading } = useNavTabs()
  const [menuTitle, setMenuTitle] = useState<string>('')
  
  // 백엔드에서 메뉴 이름과 탭 정보 가져오기
  useEffect(() => {
    fetchNavMenu().then((items) => {
      // /report 경로에 해당하는 메뉴 찾기
      const reportItem = items.find(item => 
        item.link === '/report' || 
        item.linkValue === '/report' ||
        (item.linkType === 'page' && item.linkValue === '/report')
      )
      if (reportItem) {
        setMenuTitle(reportItem.name)
      }
    }).catch(() => {
      // 에러 발생 시 기본값 유지
    })
  }, [])

  const menuData = tabs.length > 0 
    ? tabs.map((t) => ({ label: t.label, href: t.href })) 
    : (isLoading ? [] : [])

  // 탭이 없으면 기본 게시판만 표시
  if (menuData.length === 0 && !isLoading) {
    return (
      <div className="content__wrap">
        <PageTitle label={menuTitle || '리포트'} />
        <Board boardId="B003" />
      </div>
    )
  }

  return (
    <div className="content__wrap">
      <PageTitle label={menuTitle || '리포트'} />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={menuData} variant="menu" />
        </Suspense>
        <TabPanel>
          <Board boardId="B003" />
        </TabPanel>
      </Tabs>
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="리포트" /></div>}>
      <ReportContent />
    </Suspense>
  )
}
