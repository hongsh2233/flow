import { memo } from "react";
import type { ExchangeRatesProps } from "@/lib/types";
import styles from "./ExchangeRates.module.css";

export const ExchangeRates = memo(function ExchangeRates({ rates, interestRates, baseTimestamp }: ExchangeRatesProps) {
  return (
    <div className={styles.section}>
      {/* 환율 */}
      {rates.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <p className={styles.groupLabel}>환율</p>
            {baseTimestamp && <p className={styles.timestamp}>{baseTimestamp} 기준</p>}
          </div>
          <ul className={styles.list}>
            {rates.map((item) => (
              <li key={item.currency} className={styles.row}>
                <span className={styles.rowName}>{item.currency}</span>
                <span className={styles.rowValue}>{item.rate}</span>
                <span className={`${styles.rowChange} ${item.isPositive ? styles.changeUp : styles.changeDown}`}>
                  {item.change}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 금리 */}
      {interestRates && interestRates.length > 0 && (
        <div className={`${styles.group} ${styles.groupDivider}`}>
          <p className={styles.groupLabel}>금리</p>
          <ul className={styles.list}>
            {interestRates.map((item) => (
              <li key={item.name} className={styles.row}>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.rowValue}>{item.rate}</span>
                <span className={`${styles.rowChange} ${item.isPositive ? styles.changeUp : styles.changeDown}`}>
                  {item.change}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
