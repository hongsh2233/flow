'use client'

import * as React from 'react'
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import PageTitle from '../components/element/PageTitle'
import Tabs from '../components/element/tabsUi/Tabs'
import TabList from '../components/element/tabsUi/TabList'
import TabPanel from '../components/element/tabsUi/TabPanel'
import TabCont from '../components/element/tabsUi/TabCont'
import StockList from '../components/module/stock/StockList'
import StockNews from '../components/module/stock/StockNews'
import StockRightScheduleSearch from '../components/module/stock/StockRightScheduleSearch'
import Accordion from '../components/element/Accordion'

// 서비스 및 타입 임포트
import { fetchKrxData } from '../../lib/services/krxService'
import { fetchFscStockPrice } from '../../lib/services/fscService'
import { KrxData } from '../../lib/types/api'
import { getAuthHeaders, API_BASE_URL } from '../../lib/config/api'

// 커스텀 훅 임포트
import { useFavoriteStocks } from '../hooks/useFavoriteStocks'
import { useNavTabs } from '../hooks/useNavTabs'
import { fetchNavMenu } from '@/lib/services/navMenuService'

interface StockItemProps {
  name: string
  code: string
  price: string
  percent: string
  // 추가 필드들 (선택적)
  basDt?: string
  bas_dt?: string
  isinCd?: string
  isin_cd?: string
  mrktCtg?: string
  mrkt_ctg?: string
  vs?: string
  vs_cd?: string
  mkp?: string
  mkp_cd?: string
  hipr?: string
  hipr_cd?: string
  lopr?: string
  lopr_cd?: string
  trqu?: string
  trqu_cd?: string
  trPrc?: string
  tr_prc?: string
  lstgStCnt?: string
  lstg_st_cnt?: string
  mrktTotAmt?: string
  mrkt_tot_amt?: string
}

interface IndexItemProps {
  name: string
  value: string
  change: string
  percent: string
}

function StockInfoContent() {
  const { data: session } = useSession()

  // 커스텀 훅 사용
  const { favCodes, allStockData, favoriteStocks: favStocks, mapToStockItem } = useFavoriteStocks()
  const { tabs } = useNavTabs()

  // 탭 메뉴 설정 (백엔드에서 가져온 탭이 있으면 사용, 없으면 기본값)
  const defaultMenuData = [
    { label: '시장현황', href: '/stock_info' },
    { label: '상승종목(50)', href: '/stock_info' },
    { label: '시가총액(200)', href: '/stock_info' },
    { label: '종목검색', href: '/stock_info' },
  ]
  
  const menuData = tabs.length > 0 
    ? tabs.map((t) => ({ label: t.label, href: t.href || '/stock_info' }))
    : defaultMenuData

  // 상태 관리
  const [indices, setIndices] = useState<IndexItemProps[]>([])
  const [kospiData, setKospiData] = useState<StockItemProps[]>([])
  const [kosdaqData, setKosdaqData] = useState<StockItemProps[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // [추가] 데이터 기준일자 상태
  const [baseDate, setBaseDate] = useState<string>('')

  // 헬퍼 함수들
  const convertIndexItemToStockItem = useCallback(
    (indexItem: any, basDd: string): StockItemProps => {
      const idxNm = indexItem.IDX_NM || indexItem.idx_nm || indexItem.name || ''
      const clpr =
        indexItem.CLSPRC_IDX ||
        indexItem.clsprc_idx ||
        indexItem.clpr ||
        indexItem.CLPR ||
        '0'
      const fltRt =
        indexItem.FLUC_RT ||
        indexItem.fluc_rt ||
        indexItem.flt_rt ||
        indexItem.FLT_RT ||
        '0'
      const itemBasDd = indexItem.BAS_DD || indexItem.bas_dd || basDd || ''

      return {
        name: idxNm || '알 수 없음',
        code: itemBasDd,
        price: Number(clpr).toLocaleString('ko-KR'),
        percent: `${Number(fltRt) > 0 ? '+' : ''}${Number(fltRt).toFixed(2)}%`,
      }
    },
    []
  )

  const extractIndexArray = useCallback((krxItem: KrxData): any[] => {
    const data = krxItem.data || krxItem
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object') {
      if (Array.isArray(data.OutBlock_1)) return data.OutBlock_1
      if (Array.isArray(data.items)) return data.items
      if (Array.isArray(data.data)) return data.data
      return [data]
    }
    return []
  }, [])

  // 상승종목 (0.01% 이상 상승, 코스피/코스닥 구분, 내림차순)
  const [highFlucStocks, setHighFlucStocks] = useState<StockItemProps[]>([])
  
  useEffect(() => {
    const loadHighFlucStocks = async () => {
      try {
        // 코스피와 코스닥을 각각 가져오기 (상승 종목만: min_flt_rt > 0)
        const [kospiRes, kosdaqRes] = await Promise.all([
          fetchFscStockPrice({
            min_flt_rt: 0.01, // 0.01% 이상 상승 종목만
            mrkt_ctg: 'KOSPI',
            order_by: 'flt_rt',
            order_direction: 'desc', // 내림차순 (상승률 높은 것부터)
            limit: 1000, // API 최대값 1000
          }),
          fetchFscStockPrice({
            min_flt_rt: 0.01, // 0.01% 이상 상승 종목만
            mrkt_ctg: 'KOSDAQ',
            order_by: 'flt_rt',
            order_direction: 'desc', // 내림차순 (상승률 높은 것부터)
            limit: 1000, // API 최대값 1000
          }),
        ])

        // 원본 데이터 가져오기
        const kospiData = kospiRes.success && kospiRes.data ? kospiRes.data : []
        const kosdaqData = kosdaqRes.success && kosdaqRes.data ? kosdaqRes.data : []

        // 중복 제거를 위한 Map 사용 (srtn_cd 기준)
        const stockMap = new Map<string, any>()

        // 코스피 데이터 추가
        kospiData.forEach((item: any) => {
          const code = item.srtn_cd
          if (code && !stockMap.has(code)) {
            stockMap.set(code, item)
          }
        })

        // 코스닥 데이터 추가 (중복 제거)
        kosdaqData.forEach((item: any) => {
          const code = item.srtn_cd
          if (code && !stockMap.has(code)) {
            stockMap.set(code, item)
          }
        })

        // Map에서 배열로 변환하고 등락률 내림차순으로 정렬 (상승률 높은 것부터)
        const allData = Array.from(stockMap.values()).sort((a, b) => {
          const aFltRt = Number(a.flt_rt || 0)
          const bFltRt = Number(b.flt_rt || 0)
          // 상승 종목만 필터링 (추가 안전장치)
          if (aFltRt <= 0) return 1
          if (bFltRt <= 0) return -1
          return bFltRt - aFltRt // 내림차순
        }).filter((item: any) => {
          // 0.01% 이상 상승 종목만 필터링
          const fltRt = Number(item.flt_rt || 0)
          return fltRt >= 0.01
        })

        // 정렬된 데이터를 StockItem으로 변환
        const allStocks = allData.map(mapToStockItem)

        setHighFlucStocks(allStocks)
      } catch (error) {
        console.error('상승종목 로딩 실패:', error)
        setHighFlucStocks([])
      }
    }

    loadHighFlucStocks()
  }, [mapToStockItem])

  // 시가총액 Top 200 (코스피/코스닥 구분)
  const [mktcapKospi, setMktcapKospi] = useState<StockItemProps[]>([])
  const [mktcapKosdaq, setMktcapKosdaq] = useState<StockItemProps[]>([])
  const [mktcapLoading, setMktcapLoading] = useState(true)
  const [mktcapActiveTab, setMktcapActiveTab] = useState<'kospi' | 'kosdaq'>('kospi')

  useEffect(() => {
    const loadMktcapData = async () => {
      setMktcapLoading(true)
      try {
        // Next.js API 라우트를 통해 백엔드 API 호출
        const [kospiResponse, kosdaqResponse] = await Promise.all([
          fetch('/api/fsc-stock-price?limit=200&mrkt_ctg=KOSPI&order_by=mrkt_tot_amt&order_direction=desc'),
          fetch('/api/fsc-stock-price?limit=200&mrkt_ctg=KOSDAQ&order_by=mrkt_tot_amt&order_direction=desc')
        ])

        const kospiResult = await kospiResponse.json()
        const kosdaqResult = await kosdaqResponse.json()

        if (kospiResponse.ok && kospiResult.success && kospiResult.data) {
          setMktcapKospi(kospiResult.data.map(mapToStockItem))
        } else {
          console.warn('코스피 데이터 로딩 실패:', kospiResult)
          setMktcapKospi([])
        }

        if (kosdaqResponse.ok && kosdaqResult.success && kosdaqResult.data) {
          setMktcapKosdaq(kosdaqResult.data.map(mapToStockItem))
        } else {
          console.warn('코스닥 데이터 로딩 실패:', kosdaqResult)
          setMktcapKosdaq([])
        }
      } catch (error) {
        console.error('시가총액 데이터 로딩 실패:', error)
        setMktcapKospi([])
        setMktcapKosdaq([])
      } finally {
        setMktcapLoading(false)
      }
    }

    loadMktcapData()
  }, [mapToStockItem])

  // 초기 데이터 로딩 (KRX 데이터만, 병렬 처리로 성능 최적화)
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)

        // KRX 데이터를 병렬로 로드
        const [kospiRes, kosdaqRes] = await Promise.all([
          fetchKrxData({ data_type: 'kospi' }),
          fetchKrxData({ data_type: 'kosdaq' }),
        ])

        // 코스피 데이터 처리
        if (kospiRes.success && kospiRes.data && kospiRes.data.length > 0) {
          const firstItem = kospiRes.data[0]
          const rawDate = firstItem.bas_dd || firstItem.BAS_DD || ''

          // 날짜 포맷팅
          if (rawDate && rawDate.length === 8) {
            const formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`
            setBaseDate(formattedDate)
          }

          const latestKrxItem = kospiRes.data[0]
          const indexArray = extractIndexArray(latestKrxItem)
          const basDd = latestKrxItem.bas_dd || ''
          const kospiItems = indexArray.map((item: any) =>
            convertIndexItemToStockItem(item, basDd)
          )
          setKospiData(kospiItems)
        }

        // 코스닥 데이터 처리
        if (kosdaqRes.success && kosdaqRes.data && kosdaqRes.data.length > 0) {
          const latestKrxItem = kosdaqRes.data[0]
          const indexArray = extractIndexArray(latestKrxItem)
          const basDd = latestKrxItem.bas_dd || ''
          const kosdaqItems = indexArray.map((item: any) =>
            convertIndexItemToStockItem(item, basDd)
          )
          setKosdaqData(kosdaqItems)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [convertIndexItemToStockItem, extractIndexArray])

  // 관심종목 탭 인덱스 찾기
  const favoriteTabIndex = menuData.findIndex(m => m.label?.includes('관심') || m.label?.includes('favorite'))
  const hasFavoriteTab = favoriteTabIndex >= 0

  return (
    <div className="inner-wrap">
      {/* [수정] showDate 대신 date 속성에 직접 포맷팅된 날짜 전달 */}
      <PageTitle label="종목자료" />
      <Tabs>
        <TabList items={menuData} variant="tab" />
        <TabPanel>
          {/* 관심종목 탭이 있고 첫 번째 탭인 경우 */}
          {hasFavoriteTab && favoriteTabIndex === 0 && (
            <TabCont>
              {!session ? (
                <div className="no-data">로그인 이후 이용가능합니다.</div>
              ) : favStocks.length === 0 ? (
                <div className="no-data">관심종목이 없습니다. 종목자료에서 관심종목을 추가해주세요.</div>
              ) : (
                <div>
                  <StockList
                    stocks={favStocks.map(mapToStockItem)}
                    style={{ margin: '0px' }}
                    showFavorite={true}
                    favCodes={favCodes}
                  />
                  {favStocks.map((stock) => (
                    <div key={stock.code} style={{ marginTop: 'var(--spacing-lg)' }}>
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
          
          {/* 1. 시장현황 탭 */}
          <TabCont>
            {isLoading ? (
              <div className="no-data">로딩 중...</div>
            ) : (
              <Accordion
                items={[
                  {
                    id: 'kospi',
                    title: '💹 코스피',
                    content: (
                      <div>
                        {kospiData.length > 0 ? (
                          <StockList
                            stocks={kospiData}
                            style={{ margin: '0px' }}
                            favCodes={favCodes}
                            enableModal={false}
                          />
                        ) : (
                          <div className="no-data">
                            코스피 데이터가 없습니다.
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'kosdaq',
                    title: '🚀 코스닥',
                    content: (
                      <div>
                        {kosdaqData.length > 0 ? (
                          <StockList
                            stocks={kosdaqData}
                            style={{ margin: '0px' }}
                            favCodes={favCodes}
                            enableModal={false}
                          />
                        ) : (
                          <div className="no-data">
                            코스닥 데이터가 없습니다.
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
                defaultOpenId="kospi"
              />
            )}
          </TabCont>

          {/* 2. 등락률(50) 탭 */}
          <TabCont>
            {isLoading ? (
              <div className="no-data">로딩 중...</div>
            ) : (
              <StockList
                stocks={highFlucStocks}
                style={{ margin: '0px' }}
                showFavorite={true}
                favCodes={favCodes}
              />
            )}
          </TabCont>

          {/* 3. 시가총액(200) 탭 - 코스피/코스닥 구분 */}
          <TabCont>
            {mktcapLoading ? (
              <div className="no-data">로딩 중...</div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
                  <button
                    onClick={() => setMktcapActiveTab('kospi')}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: mktcapActiveTab === 'kospi' ? '2px solid #2c3e50' : '2px solid transparent',
                      cursor: 'pointer',
                      fontWeight: mktcapActiveTab === 'kospi' ? 600 : 500,
                      color: mktcapActiveTab === 'kospi' ? '#2c3e50' : '#6c757d',
                    }}
                  >
                    💹 코스피 ({mktcapKospi.length})
                  </button>
                  <button
                    onClick={() => setMktcapActiveTab('kosdaq')}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: mktcapActiveTab === 'kosdaq' ? '2px solid #2c3e50' : '2px solid transparent',
                      cursor: 'pointer',
                      fontWeight: mktcapActiveTab === 'kosdaq' ? 600 : 500,
                      color: mktcapActiveTab === 'kosdaq' ? '#2c3e50' : '#6c757d',
                    }}
                  >
                    🚀 코스닥 ({mktcapKosdaq.length})
                  </button>
                </div>
                {mktcapActiveTab === 'kospi' ? (
                  mktcapKospi.length > 0 ? (
                    <StockList
                      stocks={mktcapKospi}
                      style={{ margin: '0px' }}
                      showFavorite={true}
                      favCodes={favCodes}
                    />
                  ) : (
                    <div className="no-data">코스피 데이터가 없습니다.</div>
                  )
                ) : mktcapKosdaq.length > 0 ? (
                  <StockList
                    stocks={mktcapKosdaq}
                    style={{ margin: '0px' }}
                    showFavorite={true}
                    favCodes={favCodes}
                  />
                ) : (
                  <div className="no-data">코스닥 데이터가 없습니다.</div>
                )}
              </div>
            )}
          </TabCont>

          {/* 4. 종목검색 탭: 권리일정 검색 */}
          <TabCont>
            <StockRightScheduleSearch />
          </TabCont>

          {/* 관심종목 탭이 있고 첫 번째 탭이 아닌 경우 */}
          {hasFavoriteTab && favoriteTabIndex > 0 && (
            <TabCont>
              {!session ? (
                <div className="no-data">로그인 이후 이용가능합니다.</div>
              ) : favStocks.length === 0 ? (
                <div className="no-data">관심종목이 없습니다. 종목자료에서 관심종목을 추가해주세요.</div>
              ) : (
                <div>
                  <StockList
                    stocks={favStocks.map(mapToStockItem)}
                    style={{ margin: '0px' }}
                    showFavorite={true}
                    favCodes={favCodes}
                  />
                  {favStocks.map((stock) => (
                    <div key={stock.code} style={{ marginTop: 'var(--spacing-lg)' }}>
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

export default function StockInfoPage() {
  return (
    <Suspense fallback={<div className="inner-wrap"><div className="no-data">로딩 중...</div></div>}>
      <StockInfoContent />
    </Suspense>
  )
}
