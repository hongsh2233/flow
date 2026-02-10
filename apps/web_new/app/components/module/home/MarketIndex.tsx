import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import type { MarketIndexProps } from "@/lib/types";
import styles from "./MarketIndex.module.css";

export function MarketIndex({ indices }: MarketIndexProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        <Activity className={styles.headingIcon} />
        주요 지수
      </h3>

      <div className={styles.grid}>
        {indices.map((item, idx) => {
          const isKospi = idx === 0;
          return (
            <div
              key={item.name}
              className={isKospi ? styles.cardKospi : styles.cardKosdaq}
            >
              <p
                className={`${styles.cardLabel} ${
                  isKospi ? styles.labelKospi : styles.labelKosdaq
                }`}
              >
                {item.name}
              </p>
              <p className={styles.cardValue}>{item.value}</p>
              <div className={styles.changeRow}>
                {item.isPositive ? (
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
                    item.isPositive ? styles.changeUp : styles.changeDown
                  }`}
                >
                  {item.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
