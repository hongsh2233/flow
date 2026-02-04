import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { getFavoriteStocks } from '@/lib/services/authService'
import { fetchFscStockPrice } from '@/lib/services/fscService'
import type { FscStockPrice } from '@/lib/types/api'
import { useFavoriteStore } from '@/lib/stores/useFavoriteStore'

export interface StockItem {
  name: string
  code: string
  price: string
  percent: string
  // 추가 필드들 (원본 데이터의 모든 필드 포함)
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

/**
 * 관심종목 관리 커스텀 훅
 *
 * 관심종목 코드 조회, 전체 주식 데이터 로드, 필터링 로직을 통합 관리
 * page.tsx와 stock_info/page.tsx에서 중복되던 코드를 제거
 *
 * @returns {Object} 관심종목 관련 상태 및 함수
 */
export function useFavoriteStocks() {
  const { data: session } = useSession()

  // Zustand 전역 상태 사용
  const { favCodes, setFavCodes } = useFavoriteStore()

  // 로컬 상태 관리
  const [allStockData, setAllStockData] = useState<FscStockPrice[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // StockItem 변환 함수 (메모이제이션)
  const mapToStockItem = useCallback((item: FscStockPrice): StockItem => {
    const price = Number(item.clpr || 0)
    const fltRt = Number(item.flt_rt || 0)
    return {
      ...item, // 원본 데이터의 모든 필드 포함
      name: item.itms_nm ?? '-',
      code: item.srtn_cd ?? '-',
      price: price > 0 ? price.toLocaleString() : '-',
      percent: fltRt !== 0 ? `${fltRt > 0 ? '+' : ''}${fltRt}%` : '-',
    }
  }, [])

  // 관심종목 코드 목록 가져오기
  const loadFavCodes = useCallback(async () => {
    if (!session?.user?.email) {
      setFavCodes([])
      return
    }

    try {
      const result = await getFavoriteStocks(session.user.email)
      if (result.success && result.data) {
        setFavCodes(result.data.favorite_stocks)
      } else {
        console.error('관심종목 조회 실패:', result.message ?? result.error)
        setFavCodes([])
      }
    } catch (error) {
      console.error('관심종목 조회 오류:', error)
      setFavCodes([])
    }
  }, [session, setFavCodes])

  // 전체 주식 데이터 로드
  useEffect(() => {
    const loadStockData = async () => {
      setIsLoading(true)
      try {
        const response = await fetchFscStockPrice({ limit: 1000 })
        if (response.success && response.data && response.data.length > 0) {
          setAllStockData(response.data)
        } else {
          // 실패 시 빈 배열로 설정 (에러 메시지는 콘솔에만 출력)
          console.warn('FSC 주식시세 데이터가 없습니다:', response.message || '알 수 없는 오류')
          setAllStockData([])
        }
      } catch (error) {
        console.error('주식 데이터 로딩 실패:', error)
        // 에러 발생 시 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setAllStockData([])
      } finally {
        setIsLoading(false)
      }
    }
    loadStockData()
  }, [])

  // 관심종목 코드 로드 및 이벤트 리스너 등록
  useEffect(() => {
    loadFavCodes()

    const handleUpdate = () => {
      loadFavCodes()
    }

    window.addEventListener('favoritesUpdated', handleUpdate)
    return () => {
      window.removeEventListener('favoritesUpdated', handleUpdate)
    }
  }, [loadFavCodes])

  // 관심종목 목록 (useMemo로 최적화)
  const favoriteStocks = useMemo(() => {
    if (allStockData.length === 0 || favCodes.size === 0) {
      return []
    }

    return allStockData
      .filter((item) => item.srtn_cd && favCodes.has(item.srtn_cd))
      .map(mapToStockItem)
  }, [allStockData, favCodes, mapToStockItem])

  return {
    favCodes,
    allStockData,
    favoriteStocks,
    isLoading,
    mapToStockItem,
  }
}
