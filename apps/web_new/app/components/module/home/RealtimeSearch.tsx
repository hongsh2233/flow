import { memo } from "react";
import { Search as SearchIcon } from "lucide-react";
import { PriceChange } from "@/app/components/ui/PriceChange";
import type { RealtimeSearchProps } from "@/lib/types";
import styles from "./RealtimeSearch.module.css";

function formatBaseTimestamp(ts: string | null | undefined): string {
  if (!ts) return "";
  return `${ts}분 기준 데이터`;
}

export const RealtimeSearch = memo(function RealtimeSearch({ items, baseTimestamp }: RealtimeSearchProps) {
  return (
    <div className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          <SearchIcon className={styles.headingIcon} />
          검색 상위
        </h3>
        {baseTimestamp && (
          <span className={styles.baseTimestamp}>{formatBaseTimestamp(baseTimestamp)}</span>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.grid}>
          {items.map((item) => (
            <div key={item.rank} className={styles.row}>
              <div className={styles.left}>
                <span className={styles.rank}>{item.rank}</span>
                <span className={styles.name}>{item.name}</span>
              </div>
              <PriceChange
                change={item.change}
                showIcon={false}
                textClassName={styles.change}
                upClassName={styles.changeUp}
                downClassName={styles.changeDown}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
