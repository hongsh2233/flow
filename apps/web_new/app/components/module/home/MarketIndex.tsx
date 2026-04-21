import { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { MarketIndexProps } from "@/lib/types";
import styles from "./MarketIndex.module.css";

function formatMarketCloseDate(ts: string | null | undefined): string {
  if (!ts) return "";
  try {
    const parts = ts.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "";
    const [, m, d] = datePart.split("-").map(Number);
    if (!m || !d) return `수집일자: ${ts}`;
    if (timePart) {
      const [h, min] = timePart.split(":").map(Number);
      const totalMin = h * 60 + (min || 0);
      if (totalMin >= 15 * 60 + 30) {
        return `${m}/${d} 장 마감`;
      }
      return `${m}/${d} ${timePart} 기준`;
    }
    return `${m}/${d} 장 마감`;
  } catch {
    return `수집일자: ${ts}`;
  }
}

export const MarketIndex = memo(function MarketIndex({ indices, collectedDate }: MarketIndexProps) {
  return (
    <div className={styles.section}>
      {collectedDate && (
        <p className={styles.timestamp}>{formatMarketCloseDate(collectedDate)}</p>
      )}
      <div className={styles.grid}>
        {indices.map((item) => {
          const cardVariant = item.isNeutral
            ? styles.cardNeutral
            : item.isPositive
              ? styles.cardUp
              : styles.cardDown;
          return (
            <div key={item.name} className={`${styles.card} ${cardVariant}`}>
              <p className={styles.cardLabel}>{item.name}</p>
              <p className={styles.cardValue}>{item.value}</p>
              <div className={styles.changeRow}>
                {item.isNeutral ? null : item.isPositive ? (
                  <TrendingUp className={`${styles.changeIcon} ${styles.changeIconUp}`} />
                ) : (
                  <TrendingDown className={`${styles.changeIcon} ${styles.changeIconDown}`} />
                )}
                <p
                  className={`${styles.changeText} ${
                    item.isNeutral ? styles.changeNeutral : item.isPositive ? styles.changeUp : styles.changeDown
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
});
