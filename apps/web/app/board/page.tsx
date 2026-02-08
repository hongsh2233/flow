'use client'

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

function TabListWrapper({ items }: { items: Array<{ label: string; href: string }> }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TabList items={items} variant="menu" />
    </Suspense>
  )
}

function BoardContent() {
  const searchParams = useSearchParams()
  const boardId = searchParams.get('board')
  const [marketTabs, setMarketTabs] = useState<Array<{ label: string; href: string; boardId?: string }>>([])
  const [isLoadingMarketTabs, setIsLoadingMarketTabs] = useState(!!boardId)
  const [menuTitle, setMenuTitle] = useState<string>('')

  // 게시판 페이지의 경우 메뉴 이름과 탭 정보를 백엔드에서 가져오기
  useEffect(() => {
    if (!boardId) {
      Promise.resolve().then(() => {
        setMenuTitle('')
        setMarketTabs([])
        setIsLoadingMarketTabs(false)
      })
      return
    }

    fetchNavMenu().then((items) => {
      // 현재 boardId에 해당하는 메뉴 찾기
      const currentMenuItem = items.find(item => {
        if (item.linkType === 'board' && item.linkValue === boardId) {
          return true
        }
        if (item.link.includes(`board=${boardId}`)) {
          return true
        }
        return false
      })
      
      if (currentMenuItem) {
        setMenuTitle(currentMenuItem.name)
        
        // 탭 정보가 있으면 가져오기
        if (currentMenuItem.tabs && currentMenuItem.tabs.length > 0) {
          const tabsWithBoardId = currentMenuItem.tabs.map((tab) => {
            let tabBoardId: string | undefined = undefined
            if (tab.linkType === 'board' && tab.linkValue) {
              tabBoardId = tab.linkValue
            } else if (tab.href) {
              try {
                const url = new URL(tab.href, window.location.origin)
                const boardParam = url.searchParams.get('board')
                if (boardParam) {
                  tabBoardId = boardParam
                }
              } catch {
                // URL 파싱 실패 시 무시
              }
            }
            
            // href를 /board?로 시작하도록 변환
            let tabHref = tab.href
            if (tab.href.includes('/news?board=')) {
              tabHref = tab.href.replace('/news?board=', '/board?board=')
            }
            
            // href에 tab 파라미터가 없으면 추가 (link_value에 ?tab=xxx가 포함된 경우도 처리)
            if (tab.linkType === 'board' && tabHref) {
              try {
                const url = new URL(tabHref, window.location.origin)
                // link_value에서 tab 파라미터 추출 시도
                if (tab.linkValue && tab.linkValue.includes('?tab=')) {
                  const linkValueUrl = new URL(tab.linkValue.includes('http') ? tab.linkValue : `http://example.com${tab.linkValue}`)
                  const tabParam = linkValueUrl.searchParams.get('tab')
                  if (tabParam) {
                    url.searchParams.set('tab', tabParam)
                  }
                } else if (!url.searchParams.has('tab')) {
                  // tab 파라미터가 없으면 order_index 기반으로 추가
                  const tabIndex = currentMenuItem.tabs?.indexOf(tab) || 0
                  const tabParam = tabIndex === 0 ? 'market' : 'study'
                  url.searchParams.set('tab', tabParam)
                }
                tabHref = url.pathname + url.search
              } catch {
                // URL 파싱 실패 시 원본 href 사용
              }
            }
            
            return {
              label: tab.label,
              href: tabHref,
              boardId: tabBoardId
            }
          })
          setMarketTabs(tabsWithBoardId)
        } else {
          setMarketTabs([])
        }
      } else {
        setMenuTitle('게시판')
        setMarketTabs([])
      }
    }).catch((error) => {
      console.error('메뉴 정보 로딩 실패:', error)
      setMenuTitle('게시판')
      setMarketTabs([])
    }).finally(() => {
      setIsLoadingMarketTabs(false)
    })
  }, [boardId])

  if (!boardId) {
    return (
      <div className="content__wrap">
        <PageTitle label="게시판" />
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          게시판을 선택해주세요.
        </div>
      </div>
    )
  }

  const boardTab = searchParams.get('tab') || 'market'
  
  // 백엔드에서 탭 정보를 가져온 경우 탭 표시
  if (marketTabs.length > 0) {
    if (isLoadingMarketTabs) {
      return (
        <div className="content__wrap">
          <PageTitle label={menuTitle || '게시판'} />
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            로딩 중...
          </div>
        </div>
      )
    }

    const boardTabs = marketTabs.map(t => ({ label: t.label, href: t.href }))

    // 현재 탭 찾기 (tab 파라미터 매칭)
    const currentTabIndex = boardTabs.findIndex(t => {
      try {
        const tabUrl = new URL(t.href, window.location.origin)
        const tabParam = tabUrl.searchParams.get('tab')
        // tab 파라미터가 정확히 일치하거나, 둘 다 없는 경우 (첫 번째 탭)
        if (tabParam === boardTab) {
          return true
        }
        // tab 파라미터가 없고 boardTab이 'market'인 경우 첫 번째 탭으로 간주
        if (!tabParam && boardTab === 'market' && boardTabs.indexOf(t) === 0) {
          return true
        }
        return false
      } catch {
        return false
      }
    })
    
    let currentBoardId: string | undefined = undefined
    if (currentTabIndex >= 0 && marketTabs[currentTabIndex]?.boardId) {
      currentBoardId = marketTabs[currentTabIndex].boardId
    } else {
      const firstTab = marketTabs[0]
      if (firstTab?.href) {
        try {
          const url = new URL(firstTab.href, window.location.origin)
          const boardParam = url.searchParams.get('board')
          if (boardParam) {
            currentBoardId = boardParam
          }
        } catch {
          // URL 파싱 실패
        }
      }
      currentBoardId = currentBoardId || boardId
    }

    return (
      <div className="content__wrap">
        <PageTitle label={menuTitle || '게시판'} />
        <Tabs>
          <TabListWrapper items={boardTabs} />
          <TabPanel>
            <Board boardId={currentBoardId} />
          </TabPanel>
        </Tabs>
      </div>
    )
  }
  
  // 탭이 없는 경우 단순 게시판 표시
  return (
    <div className="content__wrap">
      <PageTitle label={menuTitle || '게시판'} />
      <Board boardId={boardId} />
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

