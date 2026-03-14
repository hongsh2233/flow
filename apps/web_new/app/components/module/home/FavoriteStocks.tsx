"use client";

import { memo } from "react";
import { Heart } from "lucide-react";
import type { FavoriteStocksProps } from "@/lib/types";
import styles from "./FavoriteStocks.module.css";

export const FavoriteStocks = memo(function FavoriteStocks({ stocks, onSelect }: FavoriteStocksProps) {
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
        {stocks.map((stock) => (
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
          </button>
        ))}
      </div>
    </div>
  );
});
