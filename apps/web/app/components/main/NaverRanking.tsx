'use client'

import React, { useState, useEffect } from 'react'
import styles from './NaverRanking.module.css'

interface RankingItem {
  rank: number
  stock_code: string
  stock_name: string
  current_price: string
  change: string
  change_percent: string
  volume?: string
  amount?: string
}

interface NaverRankingProps {
  rankingType?: 'volume' | 'amount' | 'search'
  limit?: number
}

interface MarketData {
  kospi: RankingItem[]
  kosdaq: RankingItem[]
}

export default function NaverRanking({
  rankingType = 'volume',
  limit = 10,
}: NaverRankingProps) {
  const [activeTab, setActiveTab] = useState<'volume' | 'amount' | 'search'>('volume')
  const [activeMarket, setActiveMarket] = useState<'kospi' | 'kosdaq'>('kospi')
  const [data, setData] = useState<MarketData>({ kospi: [], kosdaq: [] })
  const [searchData, setSearchData] = useState<RankingItem[]>([])
  const [searchCollectedAt, setSearchCollectedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (type: 'volume' | 'amount' | 'search') => {
    setLoading(true)
    setError(null)

    try {
      if (type === 'search') {
        // 검색 상위는 전체 시장 데이터만 가져오기
        const response = await fetch(
          `/api/naver-ranking?ranking_type=search&market_type=all&limit=${limit}`
        )
        const result = await response.json()

        if (result.success && result.data) {
          setSearchData(result.data)
          setSearchCollectedAt(result.collected_at ?? null)
          setData({ kospi: [], kosdaq: [] })
        } else {
          setError(result.message || '데이터를 불러올 수 없습니다.')
          setSearchData([])
          setSearchCollectedAt(null)
          setData({ kospi: [], kosdaq: [] })
        }
      } else {
        // 거래량/거래대금 상위는 코스피와 코스닥 데이터를 각각 가져오기
        const [kospiResponse, kosdaqResponse] = await Promise.all([
          fetch(`/api/naver-ranking?ranking_type=${type}&market_type=kospi&limit=${limit}`),
          fetch(`/api/naver-ranking?ranking_type=${type}&market_type=kosdaq&limit=${limit}`),
        ])

        const kospiResult = await kospiResponse.json()
        const kosdaqResult = await kosdaqResponse.json()

        setData({
          kospi: kospiResult.success && kospiResult.data ? kospiResult.data : [],
          kosdaq: kosdaqResult.success && kosdaqResult.data ? kosdaqResult.data : [],
        })
        setSearchData([])
        setSearchCollectedAt(null)

        if (!kospiResult.success && !kosdaqResult.success) {
          setError(kospiResult.message || kosdaqResult.message || '데이터를 불러올 수 없습니다.')
        }
      }
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
      setData({ kospi: [], kosdaq: [] })
      setSearchData([])
      setSearchCollectedAt(null)
      console.error('랭킹 데이터 로드 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab, limit])

  const getChangeClass = (changePercent: string) => {
    if (!changePercent) return ''
    const trimmed = changePercent.trim()
    
    // "상승", "하락" 텍스트 확인
    if (trimmed.includes('상승')) return styles.up
    if (trimmed.includes('하락')) return styles.down
    
    // +, - 기호로 시작하면 해당 클래스 반환
    if (trimmed.startsWith('+')) return styles.up
    if (trimmed.startsWith('-')) return styles.down
    
    // 부호가 없는 경우 숫자 값으로 판단 (% 제거 후 파싱)
    const numStr = trimmed.replace('상승', '').replace('하락', '').replace('%', '').trim()
    const numValue = parseFloat(numStr)
    
    if (isNaN(numValue)) return ''
    if (numValue > 0) return styles.up
    if (numValue < 0) return styles.down
    return ''
  }

  const formatChangePercent = (changePercent: string) => {
    if (!changePercent) return '-'
    
    const trimmed = changePercent.trim()
    
    // "상승", "하락" 같은 텍스트가 포함되어 있는지 확인
    if (trimmed.includes('상승')) {
      // "상승" 텍스트 제거하고 숫자만 추출
      const numStr = trimmed.replace('상승', '').replace('%', '').trim()
      const numValue = parseFloat(numStr)
      if (!isNaN(numValue)) {
        const hasPercent = trimmed.includes('%')
        return `+${Math.abs(numValue).toFixed(2)}${hasPercent ? '%' : ''}`
      }
    }
    
    if (trimmed.includes('하락')) {
      // "하락" 텍스트 제거하고 숫자만 추출
      const numStr = trimmed.replace('하락', '').replace('%', '').trim()
      const numValue = parseFloat(numStr)
      if (!isNaN(numValue)) {
        const hasPercent = trimmed.includes('%')
        return `-${Math.abs(numValue).toFixed(2)}${hasPercent ? '%' : ''}`
      }
    }
    
    // 이미 +, - 기호가 있으면 그대로 반환
    if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
      return trimmed
    }
    
    // 부호가 없는 경우 숫자 값으로 파싱하여 +, - 기호 추가
    const numStr = trimmed.replace('%', '').trim()
    const numValue = parseFloat(numStr)
    
    if (isNaN(numValue)) return changePercent
    
    // % 기호가 원래 있었는지 확인
    const hasPercent = trimmed.includes('%')
    const sign = numValue > 0 ? '+' : numValue < 0 ? '-' : ''
    const formatted = `${sign}${Math.abs(numValue).toFixed(2)}${hasPercent ? '%' : ''}`
    
    return formatted
  }

  const formatNumber = (value: string | number | null | undefined) => {
    const str = value != null ? String(value).trim() : ''
    if (!str) return '-'
    const num = parseFloat(str.replace(/,/g, ''))
    if (isNaN(num)) return str || '-'
    return num.toLocaleString('ko-KR')
  }

  /** 현재가/등락률 표시용 - 모든 탭 동일 적용 */
  const formatPrice = (item: RankingItem) => formatNumber(item.current_price)
  const formatChangePercentDisplay = (item: RankingItem) =>
    formatChangePercent(item.change_percent != null ? String(item.change_percent).trim() : '')
  const getChangeClassForItem = (item: RankingItem) =>
    getChangeClass(item.change_percent != null ? String(item.change_percent).trim() : '')

  const formatReferenceTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return isoString
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>📈 랭킹</h2>
        {activeTab === 'search' && searchCollectedAt && (
          <p className={styles.referenceTime}>
            기준시간: {formatReferenceTime(searchCollectedAt)}
          </p>
        )}
      </div>

      {/* 탭 버튼 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'volume' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('volume')
            setActiveMarket('kospi')
          }}
        >
          거래량 상위
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'amount' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('amount')
            setActiveMarket('kospi')
          }}
        >
          거래대금 상위
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
          onClick={() => setActiveTab('search')}
        >
          검색 상위
        </button>
      </div>

      {/* 거래량/거래대금 상위일 때 코스피/코스닥 서브 탭 */}
      {(activeTab === 'volume' || activeTab === 'amount') && (
        <div className={styles.subTabs}>
          <button
            className={`${styles.subTab} ${activeMarket === 'kospi' ? styles.active : ''}`}
            onClick={() => setActiveMarket('kospi')}
          >
            💹 코스피
          </button>
          <button
            className={`${styles.subTab} ${activeMarket === 'kosdaq' ? styles.active : ''}`}
            onClick={() => setActiveMarket('kosdaq')}
          >
            🚀 코스닥
          </button>
        </div>
      )}

      {/* 데이터 표시 */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>데이터 로딩 중...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : activeTab === 'search' ? (
          // 검색 상위는 전체 시장 데이터 표시
          searchData.length === 0 ? (
            <div className={styles.empty}>데이터가 없습니다.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.rankCol}>순위</th>
                    <th className={styles.nameCol}>종목명</th>
                    <th className={styles.priceCol}>현재가</th>
                    <th className={styles.changeCol}>등락률</th>
                  </tr>
                </thead>
                <tbody>
                  {searchData.map((item) => (
                    <tr key={`search-${item.stock_code}-${item.rank}`}>
                      <td className={styles.rankCol}>
                        <span className={styles.rankBadge}>{item.rank}</span>
                      </td>
                      <td className={styles.nameCol}>
                        <div className={styles.stockName}>{item.stock_name}</div>
                        <div className={styles.stockCode}>{item.stock_code}</div>
                      </td>
                      <td className={styles.priceCol}>{formatPrice(item)}</td>
                      <td className={`${styles.changeCol} ${getChangeClassForItem(item)}`}>
                        {formatChangePercentDisplay(item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // 거래량/거래대금 상위는 선택된 시장만 표시
          (activeMarket === 'kospi' ? data.kospi : data.kosdaq).length === 0 ? (
            <div className={styles.empty}>데이터가 없습니다.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.rankCol}>순위</th>
                    <th className={styles.nameCol}>종목명</th>
                    <th className={styles.priceCol}>현재가</th>
                    <th className={styles.changeCol}>등락률</th>
                    <th className={styles.volumeCol}>
                      {activeTab === 'volume' ? '거래량' : '거래대금'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(activeMarket === 'kospi' ? data.kospi : data.kosdaq).map((item) => (
                    <tr key={`${activeMarket}-${item.stock_code}-${item.rank}`}>
                      <td className={styles.rankCol}>
                        <span className={styles.rankBadge}>{item.rank}</span>
                      </td>
                      <td className={styles.nameCol}>
                        <div className={styles.stockName}>{item.stock_name}</div>
                        <div className={styles.stockCode}>{item.stock_code}</div>
                      </td>
                      <td className={styles.priceCol}>{formatPrice(item)}</td>
                      <td className={`${styles.changeCol} ${getChangeClassForItem(item)}`}>
                        {formatChangePercentDisplay(item)}
                      </td>
                      <td className={styles.volumeCol}>
                        {formatNumber(activeTab === 'volume' ? item.volume || '' : item.amount || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}

