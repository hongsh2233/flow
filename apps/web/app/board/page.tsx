'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import Board from '../components/module/Board'
import { fetchNavMenu } from '@/lib/services/navMenuService'
import { useEffect, useState } from 'react'

function BoardContent() {
  const searchParams = useSearchParams()
  const boardTab = searchParams.get('tab') || 'market'
  const [menuTitle, setMenuTitle] = useState<string>('시황')
  const [boardTabs, setBoardTabs] = useState<Array<{ label: string; href: string }>>([
    { label: '시황', href: '/board?board=B001&tab=market' },
    { label: '급등종목', href: '/board?board=B002&tab=study' },
  ])

  // 백엔드에서 메뉴 정보 가져오기
  useEffect(() => {
    fetchNavMenu().then((items) => {
      // 시황자료 메뉴 찾기 (B002 또는 B003을 linkValue로 가진 메뉴)
      const marketMenuItem = items.find(item => 
        item.linkType === 'board' && (item.linkValue === 'B001' || item.linkValue === 'B002')
      )
      if (marketMenuItem) {
        setMenuTitle(marketMenuItem.name)
        if (marketMenuItem.tabs && marketMenuItem.tabs.length > 0) {
          const tabs = marketMenuItem.tabs.map(tab => ({
            label: tab.label,
            href: tab.href.includes('/board?board=') 
              ? tab.href.replace('/board?board=', '/board?board=')
              : tab.href
          }))
          setBoardTabs(tabs)
        }
      }
    }).catch(() => {
      // 에러 발생 시 기본값 유지
    })
  }, [])

  // 게시판 ID 결정: tab 파라미터에 따라 B002(시황) 또는 B003(급등종목)
  const currentBoardId = boardTab === 'study' ? 'B002' : 'B001'

  return (
    <div className="content__wrap">
      <PageTitle label={menuTitle} />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={boardTabs} variant="menu" />
        </Suspense>
        <TabPanel>
          <Board boardId={currentBoardId} />
        </TabPanel>
      </Tabs>
    </div>
  )
}

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="게시판" /></div>}>
      <BoardContent />
    </Suspense>
  )
}
