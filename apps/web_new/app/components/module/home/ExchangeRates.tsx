import { DollarSign } from "lucide-react";
import type { ExchangeRatesProps } from "@/lib/types";
import styles from "./ExchangeRates.module.css";

export function ExchangeRates({ rates }: ExchangeRatesProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        <DollarSign className={styles.headingIcon} />
        환율 정보
      </h3>

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
}
