import { Search as SearchIcon } from "lucide-react";
import type { RealtimeSearchProps } from "@/lib/types";
import styles from "./RealtimeSearch.module.css";

export function RealtimeSearch({ items }: RealtimeSearchProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        <SearchIcon className={styles.headingIcon} />
        실시간 검색 상위
      </h3>

      <div className={styles.card}>
        <div className={styles.grid}>
          {items.map((item) => {
            const isPositive = item.change >= 0;
            return (
              <div key={item.rank} className={styles.row}>
                <div className={styles.left}>
                  <span className={styles.rank}>{item.rank}</span>
                  <span className={styles.name}>{item.name}</span>
                </div>
                <span
                  className={`${styles.change} ${
                    isPositive ? styles.changeUp : styles.changeDown
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {item.change}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
