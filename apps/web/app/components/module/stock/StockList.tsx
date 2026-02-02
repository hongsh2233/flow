'use client'

import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import styles from './StockList.module.css'
import Button from '../../element/Button'
import {
  getFavoriteStocks,
  addFavoriteStock,
  removeFavoriteStock,
} from '@/lib/services/authService'
import {
  safeGetString,
  formatDate,
  formatNumber,
  formatAmount,
  getRateColor,
} from '@/lib/utils/safeAccess'

interface StockItem {
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

interface StockListProps {
  stocks: StockItem[]
  showFavorite?: boolean
  style?: React.CSSProperties
  favCodes?: Set<string>
  // true면 각 종목 클릭 시 상세 모달 오픈, false면 모달 사용 안 함
  enableModal?: boolean
}

export default function StockList({
  stocks = [],
  showFavorite = false,
  style,
  favCodes,
  enableModal = true,
}: StockListProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const [internalFavs, setInternalFavs] = useState<Set<string>>(new Set())
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 백엔드에서 관심종목 목록 가져오기
  const loadFavorites = useCallback(async () => {
    if (!session?.user?.email) {
      setInternalFavs(new Set())
      return
    }

    setIsLoadingFavorites(true)
    try {
      const result = await getFavoriteStocks(session.user.email)
      if (result.success && result.data) {
        setInternalFavs(new Set(result.data.favorite_stocks))
      } else {
        console.error('관심종목 조회 실패:', result.detail)
        setInternalFavs(new Set())
      }
    } catch (error) {
      console.error('관심종목 조회 오류:', error)
      setInternalFavs(new Set())
    } finally {
      setIsLoadingFavorites(false)
    }
  }, [session])

  const handleOpenModal = (stock: StockItem) => {
    setSelectedStock(stock)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedStock(null)
  }

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isModalOpen])

  useEffect(() => {
    loadFavorites()

    // 이벤트 리스너로 다른 컴포넌트에서 업데이트된 경우 반영
    const handleFavoritesUpdate = () => {
      loadFavorites()
    }

    window.addEventListener('favoritesUpdated', handleFavoritesUpdate)
    return () => {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate)
    }
  }, [loadFavorites])

  const toggleFavorite = async (code: string) => {
    // 1. 로그인 체크
    if (!session?.user?.email) {
      if (
        confirm(
          '로그인 이후 이용할수 있습니다. 로그인페이지로 이동하시겠습니까 ?'
        )
      ) {
        router.push('/login')
      }
      return
    }

    const email = session.user.email
    const isFavorite = internalFavs.has(code)

    try {
      if (isFavorite) {
        // 삭제
        const result = await removeFavoriteStock({ email, stock_code: code })
        if (result.success && result.data) {
          setInternalFavs(new Set(result.data.favorite_stocks))
          window.dispatchEvent(new Event('favoritesUpdated'))
        } else {
          alert(result.detail || '관심종목 삭제에 실패했습니다.')
        }
      } else {
        // 추가 (최대 5개 제한 확인)
        if (internalFavs.size >= 5) {
          alert('최대 5개 종목까지만 등록할 수 있습니다.')
          return
        }

        const result = await addFavoriteStock({ email, stock_code: code })
        if (result.success && result.data) {
          setInternalFavs(new Set(result.data.favorite_stocks))
          window.dispatchEvent(new Event('favoritesUpdated'))
        } else {
          alert(result.detail || '관심종목 추가에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('관심종목 토글 오류:', error)
      alert('관심종목 처리 중 오류가 발생했습니다.')
    }
  }

  const effectiveFavs = favCodes || internalFavs

  const getStatusClass = (percent: string) => {
    if (percent.includes('+')) return styles.up
    if (percent.includes('-')) return styles.down
    return ''
  }

  // 모달용 테이블 데이터 생성 (유틸리티 함수 사용)
  const getModalTableData = (stock: StockItem) => {
    const basDt = safeGetString(stock, ['basDt', 'bas_dt'], '-')
    const isinCd = safeGetString(stock, ['isinCd', 'isin_cd'], '-')
    const mrktCtg = safeGetString(stock, ['mrktCtg', 'mrkt_ctg'], '-')
    const vs = safeGetString(stock, ['vs', 'vs_cd'], '-')
    const mkp = safeGetString(stock, ['mkp', 'mkp_cd'], '-')
    const hipr = safeGetString(stock, ['hipr', 'hipr_cd'], '-')
    const lopr = safeGetString(stock, ['lopr', 'lopr_cd'], '-')
    const trqu = safeGetString(stock, ['trqu', 'trqu_cd'], '-')
    const trPrc = safeGetString(stock, ['trPrc', 'tr_prc'], '-')
    const lstgStCnt = safeGetString(stock, ['lstgStCnt', 'lstg_st_cnt'], '-')
    const mrktTotAmt = safeGetString(stock, ['mrktTotAmt', 'mrkt_tot_amt'], '-')

    return [
      { label: '기준일자', value: formatDate(basDt) },
      { label: '단축코드', value: stock.code },
      { label: 'ISIN코드', value: isinCd },
      { label: '종목명', value: stock.name },
      { label: '시장구분', value: mrktCtg },
      { label: '종가', value: stock.price ? `${formatNumber(stock.price.replace(/[원,]/g, ''))}원` : '-' },
      {
        label: '대비',
        value: vs !== '-' ? (() => {
          const vsNum = Number(vs)
          const sign = vsNum > 0 ? '+' : ''
          return `${sign}${formatNumber(vs)}원`
        })() : '-',
        color: vs !== '-' ? getRateColor(vs) : undefined,
      },
      {
        label: '등락율(%)',
        value: stock.percent || '-',
        color: stock.percent ? getRateColor(stock.percent) : undefined,
      },
      { label: '시가', value: mkp !== '-' ? `${formatNumber(mkp)}원` : '-' },
      { label: '고가', value: hipr !== '-' ? `${formatNumber(hipr)}원` : '-' },
      { label: '저가', value: lopr !== '-' ? `${formatNumber(lopr)}원` : '-' },
      { label: '거래량', value: trqu !== '-' ? `${formatNumber(trqu)}주` : '-' },
      { label: '거래대금', value: formatAmount(trPrc) },
      { label: '상장주식수', value: lstgStCnt !== '-' ? `${formatNumber(lstgStCnt)}주` : '-' },
      { label: '시가총액', value: formatAmount(mrktTotAmt) },
    ]
  }

  return (
    <>
      {enableModal && isModalOpen && selectedStock && (
        <div
          className={styles.modal__overlay}
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-modal-title"
        >
          <div
            className={styles.modal__content}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modal__header}>
              <h2 id="stock-modal-title" className={styles.modal__title}>{selectedStock.name}</h2>
              <button
                className={styles.modal__close}
                onClick={handleCloseModal}
                aria-label="모달 닫기"
              >
                ✕
              </button>
            </div>
            <div className={styles.modal__body}>
              <table className={styles.modal__table}>
                <tbody>
                  {getModalTableData(selectedStock).map((row, index) => (
                    <tr key={index}>
                      <td className={styles.modal__label}>{row.label}</td>
                      <td
                        className={styles.modal__value}
                        style={{ color: row.color || '#333' }}
                      >
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <div className={styles.stock__wrap} style={style} role="list" aria-label="주식 목록">
      {stocks.length > 0 ? (
        stocks.map((stock, index) => {
          const statusClass = getStatusClass(stock.percent)
          const isFav = effectiveFavs.has(stock.code)

          return (
            <div
              key={`${stock.code}-${index}`}
              className={`${styles.stock__items} ${statusClass}`}
              role="listitem"
            >
              <div
                className={styles.title__area}
                {...(enableModal
                  ? {
                      onClick: () => handleOpenModal(stock),
                      onKeyPress: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleOpenModal(stock)
                        }
                      },
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': `${stock.name} 상세 정보 보기`,
                    }
                  : {})}
              >
                <div className={styles.name}>{stock.name}</div>
                <div className={styles.code}>{stock.code}</div>
              </div>
              <div className={styles.value__area}>
                <div className={styles.price}>{stock.price}</div>
                <div className={styles.percent}>{stock.percent}</div>
              </div>
              {showFavorite && (
                <div
                  className={`${styles.favoritor} ${
                    isFav ? styles.favoritor_active : ''
                  }`}
                >
                  <Button
                    onClick={() => toggleFavorite(stock.code)}
                    isFavorite={isFav}
                    className="btn-single-favoritor"
                    label="즐겨찾기"
                  />
                </div>
              )}
              <div className="ir-text">
                기준일자 {stock.basDt || stock.bas_dt || '-'}, 단축코드 {stock.code}, ISIN코드 {stock.isinCd || stock.isin_cd || '-'}, 종목명 {stock.name}, 시장구분 {stock.mrktCtg || stock.mrkt_ctg || '-'}, 종가 {stock.price}, 대비 {stock.vs || stock.vs_cd || '-'}, 등락율 {stock.percent}, 시가 {stock.mkp || stock.mkp_cd || '-'}, 고가 {stock.hipr || stock.hipr_cd || '-'}, 저가 {stock.lopr || stock.lopr_cd || '-'}, 거래량 {stock.trqu || stock.trqu_cd || '-'}, 거래대금 {stock.trPrc || stock.tr_prc || '-'}, 상장주식수 {stock.lstgStCnt || stock.lstg_st_cnt || '-'}, 시가총액 {stock.mrktTotAmt || stock.mrkt_tot_amt || '-'}
              </div>
            </div>
          )
        })
      ) : (
        <div className={styles.no__data}>표시할 주식 데이터가 없습니다.</div>
      )}
      </div>
    </>
  )
}
