import { memo } from "react";
import { DollarSign, TrendingUp } from "lucide-react";
import type { ExchangeRatesProps } from "@/lib/types";
import styles from "./ExchangeRates.module.css";

function formatBaseTimestamp(ts: string | null | undefined): string {
  if (!ts) return "";
  return `${ts}분 기준 데이터`;
}

export const ExchangeRates = memo(function ExchangeRates({ rates, interestRates, baseTimestamp }: ExchangeRatesProps) {
  const getDirectionByChange = (change: string, fallbackPositive: boolean) => {
    const s = String(change);
    if (/[+\uFF0B▲△]/.test(s)) return true;
    if (/[-\u2212▼▽]/.test(s)) return false;
    return fallbackPositive;
  };

  return (
    <div className={styles.section}>
      {/* 환율 */}
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <DollarSign className={styles.headingIcon} />
          환율
        </h3>
        {baseTimestamp && (
          <span className={styles.baseTimestamp}>{formatBaseTimestamp(baseTimestamp)}</span>
        )}
      </div>

      <div className={styles.grid}>
        {rates.map((item) => {
          const isPositive = getDirectionByChange(item.change, item.isPositive);
          return (
          <div key={item.currency} className={styles.card}>
            <p className={styles.currency}>{item.currency}</p>
            <p className={styles.rate}>{item.rate}</p>
            <p
              className={`${styles.change} ${
                isPositive ? styles.changeUp : styles.changeDown
              }`}
            >
              {item.change}
            </p>
          </div>
        )})}
      </div>

      {/* 금리 */}
      {interestRates && interestRates.length > 0 && (
        <>
          <div className={`${styles.headingRow} ${styles.interestHeadingRow}`}>
            <h3 className={styles.heading}>
              <TrendingUp className={styles.headingIconInterest} />
              주요 금리
            </h3>
          </div>
          <div className={styles.grid}>
            {interestRates.map((item) => {
              const isPositive = getDirectionByChange(item.change, item.isPositive);
              return (
              <div key={item.name} className={styles.card}>
                <p className={styles.currency}>{item.name}</p>
                <p className={styles.rate}>{item.rate}</p>
                <p
                  className={`${styles.change} ${
                    isPositive ? styles.changeUp : styles.changeDown
                  }`}
                >
                  {item.change}
                </p>
              </div>
            )})}
          </div>
        </>
      )}
    </div>
  );
});
