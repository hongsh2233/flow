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
  const boardId = searchParams.get('board')
  const boardTab = searchParams.get('tab') || 'market'
  const [menuTitle, setMenuTitle] = useState<string>('시황자료')
  const [boardTabs, setBoardTabs] = useState<Array<{ label: string; href: string; boardId?: string }>>([
    { label: '시황', href: '/board?board=B001&tab=market', boardId: 'B001' },
    { label: '급등종목', href: '/board?board=B002&tab=study', boardId: 'B002' },
  ])

  // 백엔드에서 메뉴 정보 가져오기
  useEffect(() => {
    fetchNavMenu().then((items) => {
      // 시황자료 메뉴 찾기 (B001 또는 B002를 linkValue로 가진 메뉴)
      const marketMenuItem = items.find(item => 
        item.linkType === 'board' && (item.linkValue === 'B001' || item.linkValue === 'B002')
      )
      if (marketMenuItem) {
        setMenuTitle(marketMenuItem.name)
        if (marketMenuItem.tabs && marketMenuItem.tabs.length > 0) {
          const tabs = marketMenuItem.tabs.map(tab => {
            // href에서 board 파라미터 추출
            let tabBoardId: string | undefined = undefined
            if (tab.href) {
              try {
                const url = new URL(tab.href, window.location.origin)
                const boardParam = url.searchParams.get('board')
                if (boardParam) {
                  tabBoardId = boardParam
                }
              } catch {
                // URL 파싱 실패 시 linkValue에서 추출 시도
                if (tab.linkValue) {
                  tabBoardId = tab.linkValue
                }
              }
            }
            
            // href를 /board?로 시작하도록 변환
            let tabHref = tab.href
            if (tab.href.includes('/news?board=')) {
              tabHref = tab.href.replace('/news?board=', '/board?board=')
            }
            
            return {
              label: tab.label,
              href: tabHref,
              boardId: tabBoardId
            }
          })
          setBoardTabs(tabs)
        }
      }
    }).catch(() => {
      // 에러 발생 시 기본값 유지
    })
  }, [])

  // 게시판 ID 결정: URL의 board 파라미터 우선, 없으면 tab에 따라 결정
  // B001 = 시황, B002 = 급등종목
  let currentBoardId: string
  if (boardId) {
    currentBoardId = boardId
  } else {
    // tab 파라미터에 따라 기본값 설정
    currentBoardId = boardTab === 'study' ? 'B002' : 'B001'
  }

  // 현재 활성 탭의 게시판 ID 찾기
  const activeTabBoardId = boardTabs.find(tab => {
    try {
      const url = new URL(tab.href, window.location.origin)
      const tabParam = url.searchParams.get('tab')
      return tabParam === boardTab
    } catch {
      return false
    }
  })?.boardId

  // 활성 탭의 게시판 ID가 있으면 사용, 없으면 currentBoardId 사용
  const finalBoardId = activeTabBoardId || currentBoardId

  return (
    <div className="content__wrap">
      <PageTitle label={menuTitle} />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={boardTabs.map(t => ({ label: t.label, href: t.href }))} variant="menu" />
        </Suspense>
        <TabPanel>
          <Board boardId={finalBoardId} />
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
