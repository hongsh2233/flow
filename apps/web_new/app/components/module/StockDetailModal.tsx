'use client'

import {
    X,
    TrendingUp,
    TrendingDown,
    Info,
    Heart,
    BarChart3,
    DollarSign,
} from 'lucide-react'
import styles from './StockDetailModal.module.css'

export interface StockDetail {
    name: string
    code: string
    price: number
    change: number
    volume?: string
    marketCap?: string
}

export interface StockDetailModalProps {
    stock: StockDetail | null
    onClose: () => void
    onAddFavorite?: (stock: StockDetail) => void
    onShowChart?: (stock: StockDetail) => void
}

export function StockDetailModal({
    stock,
    onClose,
    onAddFavorite,
    onShowChart,
}: StockDetailModalProps) {
    if (!stock) return null

    const isPositive = stock.change >= 0

    const volatility =
        Math.abs(stock.change) < 3
        ? { label: '안정', className: styles.badgeStable }
        : Math.abs(stock.change) < 5
            ? { label: '보통', className: styles.badgeNormal }
            : { label: '높음', className: styles.badgeHigh }

    return (
        <div
        className={styles.overlay}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-modal-title"
        >
        <div className={styles.modal}>
            {/* 헤더 */}
            <div className={styles.header}>
            <div className={styles.headerTop}>
                <div className={styles.titleArea}>
                <h2 id="stock-modal-title">{stock.name}</h2>
                <p>{stock.code}</p>
                </div>
                <button
                type="button"
                onClick={onClose}
                className={styles.closeBtn}
                aria-label="닫기"
                >
                <X />
                </button>
            </div>

            {/* 현재 가격 */}
            <div className={styles.priceCard}>
                <div className={styles.priceCardTop}>
                <div>
                    <p className={styles.priceCardLabel}>현재가</p>
                    <p className={styles.priceValue}>
                    {stock.price.toLocaleString()}원
                    </p>
                </div>
                {isPositive ? (
                    <TrendingUp className={styles.trendIcon} aria-hidden />
                ) : (
                    <TrendingDown className={styles.trendIcon} aria-hidden />
                )}
                </div>
                <div className={styles.changeRow}>
                <span className={styles.changeValue}>
                    {isPositive ? '+' : ''}
                    {stock.change}%
                </span>
                <span className={styles.changeLabel}>전일 대비</span>
                </div>
            </div>
            </div>

            {/* 콘텐츠 */}
            <div className={styles.content}>
            {/* 주요 정보 */}
            <div className={styles.infoGrid}>
                {stock.volume && (
                <div className={`${styles.infoCard} ${styles.infoCardBlue}`}>
                    <div className={styles.infoCardHeader}>
                    <BarChart3 aria-hidden />
                    <p>거래량</p>
                    </div>
                    <p className={styles.infoCardValue}>{stock.volume}</p>
                </div>
                )}
                {stock.marketCap && (
                <div className={`${styles.infoCard} ${styles.infoCardPurple}`}>
                    <div className={styles.infoCardHeader}>
                    <DollarSign aria-hidden />
                    <p>시가총액</p>
                    </div>
                    <p className={styles.infoCardValue}>{stock.marketCap}</p>
                </div>
                )}
            </div>

            {/* 주린이 설명 */}
            <div className={styles.explainBox}>
                <div className={styles.explainInner}>
                <Info className={styles.explainIcon} aria-hidden />
                <div className={styles.explainContent}>
                    <h4>주린이를 위한 설명</h4>
                    <ul className={styles.explainList}>
                    <li>
                        <strong>현재가:</strong> 지금 이 순간의 주식 가격이에요
                    </li>
                    <li>
                        <strong>등락률:</strong> 어제보다 얼마나 올랐거나
                        떨어졌는지예요
                    </li>
                    {stock.volume && (
                        <li>
                        <strong>거래량:</strong> 오늘 거래된 주식 수량이에요
                        </li>
                    )}
                    {stock.marketCap && (
                        <li>
                        <strong>시가총액:</strong> 이 회사의 전체 가치예요
                        </li>
                    )}
                    </ul>
                </div>
                </div>
            </div>

            {/* 변동성 정보 */}
            <div className={styles.volatilitySection}>
                <h4>오늘의 변동성</h4>
                <div className={styles.badgeRow}>
                <span className={`${styles.badge} ${volatility.className}`}>
                    {volatility.label}
                </span>
                </div>
            </div>

            {/* 액션 버튼 */}
            <div className={styles.actionGrid}>
                <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={() => onAddFavorite?.(stock)}
                >
                <Heart aria-hidden />
                관심 추가
                </button>
                <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                onClick={() => onShowChart?.(stock)}
                >
                <BarChart3 aria-hidden />
                상세 차트
                </button>
            </div>
            </div>
        </div>
        </div>
    )
}
