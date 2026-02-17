"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { StockCardProps } from "@/lib/types";
import styles from "./StockCard.module.css";

export function StockCard({ stocks, onSelect }: StockCardProps) {
    return (
        <div className={styles.list}>
        {stocks.map((stock) => {
            const change = typeof stock.change === "string" ? parseFloat(stock.change) || 0 : stock.change;
            const isPositive = change >= 0;
            return (
            <button
            key={`${stock.code}-${stock.rank}`}
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
                    {isPositive ? (
                    <TrendingUp className={`${styles.changeIcon} ${styles.changeUp}`} aria-hidden />
                    ) : (
                    <TrendingDown className={`${styles.changeIcon} ${styles.changeDown}`} aria-hidden />
                    )}
                    <p className={isPositive ? `${styles.changeText} ${styles.changeUp}` : `${styles.changeText} ${styles.changeDown}`}>
                    {isPositive ? "+" : ""}{change}%
                    </p>
                </div>
                </div>
            </div>
            </button>
            );
        })}
        </div>
    )
}
