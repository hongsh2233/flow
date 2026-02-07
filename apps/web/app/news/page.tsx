'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import TabCont from '../components/element/tabsUi/TabCont'
import NaverNews from '../components/module/NaverNews'
import StockNews from '../components/module/stock/StockNews'
import { useNavTabs } from '../hooks/useNavTabs'
import { useFavoriteStocks } from '../hooks/useFavoriteStocks'

const DEFAULT_TABS = [
  { label: '전체뉴스', href: '/news' },
  { label: '관심뉴스', href: '/news?tab=favorite' },
]

export default function NewsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'all'
  const { tabs, isLoading } = useNavTabs()
  const { favoriteStocks } = useFavoriteStocks()
  
  const menuData = tabs.length > 0 
    ? tabs.map((t) => ({ label: t.label, href: t.href })) 
    : DEFAULT_TABS

  return (
    <div className="content__wrap">
      <PageTitle label="뉴스" />
      <Tabs>
        <TabList items={menuData} variant="menu" />
        <TabPanel>
          {/* 전체뉴스 탭 */}
          {activeTab !== 'favorite' && (
            <TabCont>
              <NaverNews />
            </TabCont>
          )}
          
          {/* 관심뉴스 탭 */}
          {activeTab === 'favorite' && (
            <TabCont>
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
            </TabCont>
          )}
        </TabPanel>
      </Tabs>
    </div>
  )
}
