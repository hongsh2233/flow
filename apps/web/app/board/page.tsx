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

const DEFAULT_TABS = [
  { label: '시황', href: `/board?board=B002&tab=market` },
  { label: '급등종목', href: `/board?board=B003&tab=study` },
]

function NewsContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'all'
  const boardId = searchParams.get('board')
  const { tabs } = useNavTabs()
  const { favoriteStocks } = useFavoriteStocks()
  
  const menuData = tabs.length > 0 
    ? tabs.map((t) => ({ label: t.label, href: t.href })) 
    : DEFAULT_TABS

  // board 쿼리 파라미터가 있으면 게시판 표시 (시황자료 페이지)
  if (boardId) {
    const boardTab = searchParams.get('tab') || 'market'
    // 시황자료는 항상 B002(시황), B003(급등종목) 사용
    const marketBoardId = 'B001'
    const studyBoardId = 'B002'
    
    const boardTabs = [
      { label: '시황', href: `/board?board=B002&tab=market` },
      { label: '급등종목', href: `/board?board=B003&tab=study` },
    ]

    return (
      <div className="content__wrap">
        <PageTitle label="시황자료" />
        <Tabs>
          <Suspense fallback={<div>Loading...</div>}>
            <TabList items={boardTabs} variant="menu" />
          </Suspense>
          <TabPanel>
            {/* 시황 탭 */}
            {boardTab !== 'study' && (
              <div>
                <Board boardId={marketBoardId} />
              </div>
            )}
            
            {/* 급등종목 탭 */}
            {boardTab === 'study' && (
              <div>
                <Board boardId={studyBoardId} />
              </div>
            )}
          </TabPanel>
        </Tabs>
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
