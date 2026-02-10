"use client";

import { Heart, TrendingUp, TrendingDown } from "lucide-react";
import type { FavoriteStocksProps } from "@/lib/types";
import styles from "./FavoriteStocks.module.css";

export function FavoriteStocks({ stocks, onSelect }: FavoriteStocksProps) {
  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.heading}>
          <Heart className={styles.heartIcon} />
          나의 관심종목
        </h3>
        <span className={styles.count}>{stocks.length}개</span>
      </div>

      <div className={styles.grid}>
        {stocks.map((stock) => {
          const isPositive = stock.change >= 0;
          return (
            <button
              key={stock.id}
              type="button"
              onClick={() =>
                onSelect({
                  name: stock.name,
                  code: stock.code,
                  price: stock.price,
                  change: stock.change,
                })
              }
              className={styles.card}
            >
              <h4 className={styles.stockName}>{stock.name}</h4>
              <p className={styles.stockCode}>{stock.code}</p>
              <p className={styles.stockPrice}>
                {stock.price.toLocaleString()}
              </p>
              <div className={styles.changeRow}>
                {isPositive ? (
                  <TrendingUp
                    className={`${styles.changeIcon} ${styles.changeIconUp}`}
                  />
                ) : (
                  <TrendingDown
                    className={`${styles.changeIcon} ${styles.changeIconDown}`}
                  />
                )}
                <p
                  className={`${styles.changeText} ${
                    isPositive ? styles.changeUp : styles.changeDown
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {stock.change}%
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
