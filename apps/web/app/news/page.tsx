'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import NaverNews from '../components/module/NaverNews'
import StockNews from '../components/module/stock/StockNews'
import Board from '../components/module/Board'
import { useNavTabs } from '../hooks/useNavTabs'
import { useFavoriteStocks } from '../hooks/useFavoriteStocks'
import { fetchNavMenu } from '@/lib/services/navMenuService'
import { useEffect, useState } from 'react'

const DEFAULT_TABS = [
  { label: '전체뉴스', href: '/news' },
  { label: '관심뉴스', href: '/news?tab=favorite' },
]

function NewsContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'all'
  const boardId = searchParams.get('board')
  const { tabs } = useNavTabs()
  const { favoriteStocks } = useFavoriteStocks()
  const [marketTabs, setMarketTabs] = useState<Array<{ label: string; href: string; boardId?: string }>>([])
  const [isLoadingMarketTabs, setIsLoadingMarketTabs] = useState(boardId === 'B002')
  const [menuTitle, setMenuTitle] = useState<string>('')
  
  const menuData = tabs.length > 0 
    ? tabs.map((t) => ({ label: t.label, href: t.href })) 
    : DEFAULT_TABS

  // 게시판 페이지의 경우 메뉴 이름을 백엔드에서 가져오기
  useEffect(() => {
    if (boardId) {
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
          
          // 시황자료(B002)의 경우 탭 정보도 함께 가져오기
          if (boardId === 'B002' && currentMenuItem.tabs && currentMenuItem.tabs.length > 0) {
            const tabsWithBoardId = currentMenuItem.tabs.map((tab) => {
              // linkType이 board인 경우 linkValue를 boardId로 사용
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
              
              return {
                label: tab.label,
                href: tab.href,
                boardId: tabBoardId
              }
            })
            setMarketTabs(tabsWithBoardId)
          } else if (boardId === 'B002') {
            setMarketTabs([])
          }
        } else {
          // 메뉴를 찾지 못한 경우 기본값
          setMenuTitle('게시판')
          if (boardId === 'B002') {
            setMarketTabs([])
          }
        }
      }).catch((error) => {
        console.error('메뉴 정보 로딩 실패:', error)
        setMenuTitle('게시판')
        if (boardId === 'B002') {
          setMarketTabs([])
        }
      }).finally(() => {
        if (boardId === 'B002') {
          setIsLoadingMarketTabs(false)
        }
      })
    } else {
      setMenuTitle('')
      setMarketTabs([])
      setIsLoadingMarketTabs(false)
    }
  }, [boardId])

  // board 쿼리 파라미터가 있으면 게시판 표시
  if (boardId) {
    const boardTab = searchParams.get('tab') || 'market'
    
    // 시황자료(B002)의 경우 특별한 탭 처리 (시황/급등종목)
    if (boardId === 'B002') {
      // 로딩 중이거나 탭이 없으면 로딩 표시
      if (isLoadingMarketTabs || marketTabs.length === 0) {
        return (
          <div className="content__wrap">
            <PageTitle label={menuTitle || '시황자료'} />
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              {isLoadingMarketTabs ? '로딩 중...' : '시황자료 탭이 설정되지 않았습니다. admin/settings에서 탭을 추가해주세요.'}
            </div>
          </div>
        )
      }

      // 백엔드에서 가져온 탭 정보 사용
      const boardTabs = marketTabs.map(t => ({ label: t.label, href: t.href }))

      // 현재 탭에 해당하는 게시판 ID 찾기
      const currentTabIndex = boardTabs.findIndex(t => {
        try {
          const tabUrl = new URL(t.href, window.location.origin)
          const tabParam = tabUrl.searchParams.get('tab')
          return tabParam === boardTab
        } catch {
          return false
        }
      })
      
      // 현재 탭의 게시판 ID 결정
      let currentBoardId: string | undefined = undefined
      if (currentTabIndex >= 0 && marketTabs[currentTabIndex]?.boardId) {
        currentBoardId = marketTabs[currentTabIndex].boardId
      } else {
        // 탭을 찾지 못한 경우 href에서 board 파라미터 추출 시도
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
        // 여전히 없으면 기본값 (B002)
        currentBoardId = currentBoardId || 'B002'
      }

      return (
        <div className="content__wrap">
          <PageTitle label={menuTitle || '시황자료'} />
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
    
    // 다른 게시판의 경우 (B001, B003 등) - URL의 board 파라미터를 직접 사용
    // tab=study인 경우에도 URL의 board 파라미터를 사용
    const actualBoardId = boardTab === 'study' && boardId === 'B002' ? 'B003' : boardId
    
    return (
      <div className="content__wrap">
        <PageTitle label={menuTitle || '게시판'} />
        <Board boardId={actualBoardId} />
      </div>
    )
  }

  return (
    <div className="content__wrap">
      {/* <PageTitle label="뉴스" /> */}
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={menuData} variant="menu" />
        </Suspense>
        <TabPanel>
          {/* 전체뉴스 탭 */}
          {activeTab !== 'favorite' && (
            <div>
              <NaverNews />
            </div>
          )}
          
          {/* 관심뉴스 탭 */}
          {activeTab === 'favorite' && (
            <div>
              {!session ? (
                <div className="no-data">로그인 이후 이용가능합니다.</div>
              ) : favoriteStocks.length === 0 ? (
                <div className="no-data">관심종목이 없습니다. 종목자료에서 관심종목을 추가해주세요.</div>
              ) : (
                <div>
                  {favoriteStocks.map((stock) => (
                    <div
                      key={stock.code}
                      style={{ marginBottom: 'var(--spacing-xl)' }}
                    >
                      <StockNews
                        stockName={stock.name}
                        stockCode={stock.code}
                        limit={10}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabPanel>
      </Tabs>
    </div>
  )
}

export default function NewsPage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="뉴스" /></div>}>
      <NewsContent />
    </Suspense>
  )
}
