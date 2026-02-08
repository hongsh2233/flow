'use client'

import React, { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import StockNews from '../components/module/stock/StockNews'
import { useNavTabs } from '../hooks/useNavTabs'
import { useFavoriteStocks } from '../hooks/useFavoriteStocks'

const DEFAULT_TABS = [  
  { label: '뉴스', href: '/disclosure' },
  { label: '관심뉴스', href: '/favoriteNews' },
]

function FavoriteNewsContent() {
  const { data: session } = useSession()
  const { tabs, isLoading } = useNavTabs()
  const { favoriteStocks } = useFavoriteStocks()
  const menuData = tabs.length > 0 ? tabs.map((t) => ({ label: t.label, href: t.href })) : (isLoading ? DEFAULT_TABS : DEFAULT_TABS)

  return (
    <div className="content__wrap">
      <PageTitle label="관심뉴스" />
      <Tabs>
        <Suspense fallback={<div>Loading...</div>}>
          <TabList items={menuData} variant="menu" />
        </Suspense>
      </Tabs>
      {!session ? (
        <div className="no-data">로그인 이후 이용가능합니다.</div>
      ) : favoriteStocks.length === 0 ? (
        <div className="no-data">관심종목이 없습니다. 종목자료에서 관심종목을 추가해주세요.</div>
      ) : (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          {favoriteStocks.map((stock) => (
            <div key={stock.code} style={{ marginBottom: 'var(--spacing-lg)' }}>
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
  )
}

export default function FavoriteNewsPage() {
  return (
    <Suspense fallback={<div className="content__wrap"><PageTitle label="관심뉴스" /></div>}>
      <FavoriteNewsContent />
    </Suspense>
  )
}
