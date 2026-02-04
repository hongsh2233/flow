// app/page.tsx
'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

// 컴포넌트 임포트
import MainTop from './components/main/MainTop'
import BasicSwiper from './components/module/swiper/BasicSwiper'
import StockIndex from './components/main/StockIndex'
import PageTitle from './components/element/PageTitle'
import StockList from './components/module/stock/StockList'
import StockNews from './components/module/stock/StockNews'
import MessageBox from './components/module/MessageBox'
import UsaIndex from './components/main/UsaIndex'
import NaverNews from './components/module/NaverNews'
import GlobalBoardSummary from './components/module/GlobalBoardSummary'
import ExchangeRate from './components/main/ExchangeRate'
import NaverRanking from './components/main/NaverRanking'

// API 서비스 임포트
import { getMainPageConfig } from '@/lib/services/mainPageService'

// 타입 임포트
import type { MainPageItem } from '@/lib/types/api'

// 커스텀 훅 임포트
import { useFavoriteStocks } from './hooks/useFavoriteStocks'

// [타입 정의] 지수 아이템
interface IndexItem {
  name: string
  value: string
  change: string
  percent: string
}

// [유틸리티 함수] 메인 페이지 아이템의 노출 여부 체크
function shouldShowItem(item: MainPageItem): boolean {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
  const currentWeekday = now.getDay() // 0=일요일, 1=월요일, ..., 6=토요일

  // is_visible 체크
  if (item.is_visible !== 'visible') {
    return false
  }

  // 반복 모드 체크
  if (item.repeat_type && item.repeat_type !== 'none') {
    if (item.repeat_type === 'daily') {
      // 매일 반복: 시간만 체크
      if (item.repeat_start_time && item.repeat_end_time) {
        const startTime = item.repeat_start_time
        const endTime = item.repeat_end_time
        const isNextDay = item.repeat_next_day === 'true'

        // 익일 옵션 체크 (예: 20:00 ~ 08:00)
        if (isNextDay && startTime > endTime) {
          // 현재 시간이 시작 시간 이후 또는 종료 시간 이전이면 노출
          if (!(currentTimeString >= startTime || currentTimeString <= endTime)) {
            return false
          }
        } else {
          // 일반적인 경우: 현재 시간이 시작 시간과 종료 시간 사이인지 체크
          if (!(startTime <= currentTimeString && currentTimeString <= endTime)) {
            return false
          }
        }
      }
    } else if (item.repeat_type === 'weekly') {
      // 주간 반복: 요일 + 시간 체크
      if (item.repeat_days) {
        const repeatDaysList = item.repeat_days.split(',').map((d) => parseInt(d.trim(), 10))

        // 현재 요일이 반복 요일에 포함되는지 체크
        if (!repeatDaysList.includes(currentWeekday)) {
          return false
        }

        // 요일이 맞으면 시간 체크
        if (item.repeat_start_time && item.repeat_end_time) {
          const startTime = item.repeat_start_time
          const endTime = item.repeat_end_time
          const isNextDay = item.repeat_next_day === 'true'

          // 익일 옵션 체크
          if (isNextDay && startTime > endTime) {
            if (!(currentTimeString >= startTime || currentTimeString <= endTime)) {
              return false
            }
          } else {
            if (!(startTime <= currentTimeString && currentTimeString <= endTime)) {
              return false
            }
          }
        }
      }
    }
  } else {
    // 기간 지정 모드
    // start_date 체크
    if (item.start_date) {
      try {
        let startDt: Date
        if (item.start_date.length > 10) {
          // YYYY-MM-DD HH:MM 형식
          startDt = new Date(item.start_date.replace(' ', 'T'))
        } else {
          // YYYY-MM-DD 형식 (하루의 시작 시간으로 처리)
          startDt = new Date(item.start_date + 'T00:00:00')
        }
        if (now < startDt) {
          return false // 아직 노출 시작일시가 아님
        }
      } catch {
        // 파싱 실패 시 날짜 형식 비교 (호환성)
        const nowStr = now.toISOString().split('T')[0]
        if (nowStr < item.start_date) {
          return false
        }
      }
    }

    // end_date 체크
    if (item.end_date) {
      try {
        let endDt: Date
        if (item.end_date.length > 10) {
          // YYYY-MM-DD HH:MM 형식
          endDt = new Date(item.end_date.replace(' ', 'T'))
        } else {
          // YYYY-MM-DD 형식 (하루의 끝 시간으로 처리: 23:59:59)
          endDt = new Date(item.end_date + 'T23:59:59')
        }
        if (now > endDt) {
          return false // 노출 종료일시가 지남
        }
      } catch {
        // 파싱 실패 시 날짜 형식 비교 (호환성)
        const nowStr = now.toISOString().split('T')[0]
        if (nowStr > item.end_date) {
          return false
        }
      }
    }
  }

  return true
}

export default function MainPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 커스텀 훅 사용
  const { favCodes, favoriteStocks, isLoading: isLoadingFavorites } = useFavoriteStocks()

  // [1] 상태 관리
  const [indices, setIndices] = useState<IndexItem[]>([
    { name: '코스피', value: '0,000.00', change: '0.00', percent: '0.00%' },
    { name: '코스닥', value: '000.00', change: '0.00', percent: '0.00%' },
  ])
  const [indexTimestamp, setIndexTimestamp] = useState<string>('')
  const [mainPageItems, setMainPageItems] = useState<MainPageItem[]>([])
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)

  // [2] 신규 회원 리다이렉트 처리
  useEffect(() => {
    // @ts-expect-error: NextAuth 세션 타입 확장 이슈 회피
    if (status === 'authenticated' && session?.user?.isNewUser) {
      router.replace('/register')
    }
  }, [session, status, router])

  // [3] 메인 페이지 설정(순서) 가져오기
  useEffect(() => {
    const fetchMainPageConfig = async () => {
      setIsLoadingConfig(true)
      try {
        const result = await getMainPageConfig()
        if (result.success && result.data && result.data.items) {
          setMainPageItems(result.data.items)
        } else {
          // 실패 시 빈 배열로 설정 (에러 메시지는 콘솔에만 출력)
          console.warn('메인 페이지 설정을 불러올 수 없습니다:', result.message || '알 수 없는 오류')
          setMainPageItems([])
        }
      } catch (error) {
        console.error('메인 페이지 설정 로딩 실패:', error)
        // 에러 발생 시 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setMainPageItems([])
      } finally {
        setIsLoadingConfig(false)
      }
    }

    fetchMainPageConfig()
  }, [])

  // [4] 국내 지수 데이터 가져오기
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const res = await fetch('/api/domestic-indices')
        const json = await res.json()
        if (json.success && json.data.length > 0) {
          setIndices(json.data)
          if (json.timestamp) {
            setIndexTimestamp(json.timestamp)
          }
        }
      } catch (error) {
        console.error('국내 지수 로딩 실패:', error)
      }
    }
    fetchIndices()
  }, [])

  // [5] 컴포넌트 매핑 함수 (useCallback으로 최적화)
  const renderComponent = useCallback((item: MainPageItem) => {
    switch (item.component_key) {
      case 'top_banner':
        return <MainTop key={item.id} />
      case 'foreign_indices':
        return <UsaIndex key={item.id} />
      case 'domestic_indices':
        return <StockIndex key={item.id} indices={indices} timestamp={indexTimestamp} />
      case 'banner':
        return <BasicSwiper key={item.id} />
      case 'favorite_stocks':
        return (
          <div key={item.id}>
            <PageTitle label="관심종목" />
            {status === 'loading' ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#888',
                  fontSize: '14px',
                }}
              >
                로그인 정보 확인 중...
              </div>
            ) : status === 'authenticated' ? (
              isLoadingFavorites ? (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#888',
                    fontSize: '14px',
                  }}
                >
                  데이터 불러오는 중...
                </div>
              ) : (
                <>
                  <StockList
                    stocks={favoriteStocks}
                    showFavorite={true}
                    favCodes={favCodes}
                  />
                  {/* 관심종목별 뉴스 (각 종목당 3개씩) */}
                  {favoriteStocks.length > 0 && (
                    <div style={{ marginTop: 'var(--spacing-lg)' }}>
                      {favoriteStocks.map((stock) => (
                        <div key={stock.code} style={{ marginBottom: 'var(--spacing-lg)' }}>
                          <StockNews
                            stockName={stock.name}
                            stockCode={stock.code}
                            limit={3}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              <MessageBox />
            )}
          </div>
        )
      case 'news':
        // 로그인 전에만 일반 뉴스 표시, 로그인 후에는 관심종목 뉴스만 표시
        return status !== 'authenticated' ? <NaverNews key={item.id} /> : null
      case 'global_board':
        return (
          <div key={item.id}>
            <PageTitle label="글로벌" />
            <GlobalBoardSummary boardId="B004" maxItems={2} />
          </div>
        )
      case 'exchange_rate':
        return <ExchangeRate key={item.id} />
      case 'naver_ranking':
        return <NaverRanking key={item.id} limit={10} />
      default:
        return null
    }
  }, [indices, indexTimestamp, status, isLoadingFavorites, favoriteStocks, favCodes])

  // [6] 렌더링 (세션 로딩 중에도 콘텐츠는 표시)
  return (
    <div className="inner-wrap">
      {isLoadingConfig ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          설정을 불러오는 중...
        </div>
      ) : (
        <>
          {mainPageItems
            .filter((item) => shouldShowItem(item))
            .map((item) => renderComponent(item))}
        </>
      )}
    </div>
  )
}
