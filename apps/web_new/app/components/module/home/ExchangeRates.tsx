import { memo } from "react";
import { DollarSign } from "lucide-react";
import type { ExchangeRatesProps } from "@/lib/types";
import styles from "./ExchangeRates.module.css";

function formatBaseTimestamp(ts: string | null | undefined): string {
  if (!ts) return "";
  return `${ts}분 기준 데이터`;
}

export const ExchangeRates = memo(function ExchangeRates({ rates, baseTimestamp }: ExchangeRatesProps) {
  return (
    <div className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <DollarSign className={styles.headingIcon} />
          환율 정보
        </h3>
        {baseTimestamp && (
          <span className={styles.baseTimestamp}>{formatBaseTimestamp(baseTimestamp)}</span>
        )}
      </div>

      <div className={styles.grid}>
        {rates.map((item) => (
          <div key={item.currency} className={styles.card}>
            <p className={styles.currency}>{item.currency}</p>
            <p className={styles.rate}>{item.rate}</p>
            <p
              className={`${styles.change} ${
                item.isPositive ? styles.changeUp : styles.changeDown
              }`}
            >
              {item.change}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});
