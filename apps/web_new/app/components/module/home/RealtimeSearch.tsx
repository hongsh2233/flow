import { memo } from "react";
import { Search as SearchIcon } from "lucide-react";
import { PriceChange } from "@/app/components/ui/PriceChange";
import type { RealtimeSearchProps } from "@/lib/types";
import styles from "./RealtimeSearch.module.css";

export const RealtimeSearch = memo(function RealtimeSearch({ items }: RealtimeSearchProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        <SearchIcon className={styles.headingIcon} />
        실시간 검색 상위
      </h3>

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
