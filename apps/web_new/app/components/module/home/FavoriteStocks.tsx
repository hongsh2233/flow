"use client";

import { Heart, TrendingUp, TrendingDown, X } from "lucide-react";
import type { FavoriteStocksProps } from "@/lib/types";
import styles from "./FavoriteStocks.module.css";

export function FavoriteStocks({ stocks, onSelect, onRemove }: FavoriteStocksProps) {
  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.heading}>
          <Heart className={styles.heartIcon} />
          나의 관심종목
        </h3>
        <span className={styles.count}>{stocks.length}개</span>
      </div>

      {stocks.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>관심종목이 없습니다.</p>
          <p className={styles.emptyHint}>종목을 검색하여 추가해보세요.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {stocks.map((stock) => {
            const isPositive = stock.change >= 0;
            return (
              <div key={stock.id} className={styles.card}>
                {onRemove && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(stock.id);
                    }}
                    aria-label={`${stock.name} 관심종목 해제`}
                  >
                    <X className={styles.removeIcon} />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.cardBody}
                  onClick={() =>
                    onSelect({
                      name: stock.name,
                      code: stock.code,
                      price: stock.price,
                      change: stock.change,
                    })
                  }
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
