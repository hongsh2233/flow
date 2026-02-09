'use client'

import { TrendingUp } from 'lucide-react'
import styles from './StockCard.module.css'

export interface RisingStock {
    rank: number
    name: string
    code: string
    price: number
    change: number | string
}

export interface StockCardProps {
    stocks: RisingStock[]
    onSelect: (stock: RisingStock) => void
}

export function StockCard({ stocks, onSelect }: StockCardProps) {
    return (
        <div className={styles.list}>
        {stocks.map((stock) => (
            <button
            key={stock.rank}
            type="button"
            onClick={() => onSelect(stock)}
            className={styles.card}
            >
            <div className={styles.inner}>
                <div className={styles.rankBadge}>
                <span className={styles.rankText}>{stock.rank}</span>
                </div>
                <div className={styles.info}>
                <h4 className={styles.name}>{stock.name}</h4>
                <p className={styles.code}>{stock.code}</p>
                </div>
                <div className={styles.priceArea}>
                <p className={styles.price}>{stock.price.toLocaleString()}</p>
                <div className={styles.changeRow}>
                    <TrendingUp className={styles.changeIcon} aria-hidden />
                    <p className={styles.changeText}>+{stock.change}%</p>
                </div>
                </div>
            </div>
            </button>
        ))}
        </div>
    )
}
