"use client";

import { memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { PriceChange } from "@/app/components/ui/PriceChange";
import type { TradeRankingProps, VolumeStock, ValueStock, StockDetail } from "@/lib/types";
import type { NaverRisingStock } from "@/lib/types/home";
import styles from "./TradeRanking.module.css";

const RankingList = memo(function RankingList({
  stocks,
  rankClass,
  onSelect,
  subKey,
}: {
  stocks: (VolumeStock | ValueStock)[];
  rankClass: string;
  onSelect: (stock: StockDetail) => void;
  subKey: "volume" | "value";
}) {
  return (
    <div className={styles.list}>
      {stocks.map((stock) => (
        <button
          key={stock.rank}
          type="button"
          onClick={() =>
            onSelect({
              name: stock.name,
              code: "code" in stock ? stock.code : "",
              price: stock.price,
              change: stock.change,
              ...(subKey === "volume" && "volume" in stock ? { volume: stock.volume } : {}),
            })
          }
          className={styles.card}
        >
          <div className={styles.cardInner}>
            <span className={rankClass}>{stock.rank}</span>
            <div className={styles.info}>
              <h4 className={styles.stockName}>{stock.name}</h4>
              <p className={styles.stockSub}>
                {subKey === "volume" && "volume" in stock ? stock.volume : "value" in stock ? (stock as ValueStock).value : ""}
              </p>
            </div>
            <div className={styles.priceArea}>
              <p className={styles.price}>
                {stock.price.toLocaleString()}
              </p>
              <PriceChange
                change={stock.change}
                showIcon={false}
                textClassName={styles.changeText}
                upClassName={styles.changeUp}
                downClassName={styles.changeDown}
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

const RisingList = memo(function RisingList({ stocks }: { stocks: NaverRisingStock[] }) {
  return (
    <div className={styles.list}>
      {stocks.map((stock) => {
        const pct = parseFloat(stock.change_percent.replace(/[%+,]/g, "")) || 0;
        const isUp = pct >= 0;
        return (
          <div key={`${stock.stock_code}-${stock.rank}`} className={styles.card}>
            <div className={styles.cardInner}>
              <span className={styles.rankBlue}>{stock.rank}</span>
              <div className={styles.info}>
                <h4 className={styles.stockName}>{stock.stock_name}</h4>
                <p className={styles.stockSub}>{stock.stock_code}</p>
              </div>
              <div className={styles.priceArea}>
                <p className={styles.price}>
                  {Number(stock.current_price.replace(/,/g, "")).toLocaleString()}
                </p>
                <p className={`${styles.changeText} ${isUp ? styles.changeUp : styles.changeDown}`}>
                  {stock.change_percent}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

function formatBaseTimestamp(ts: string | null | undefined): string {
  if (!ts) return "";
  return `${ts}분 기준 데이터`;
}

export const TradeRanking = memo(function TradeRanking({
  kospiVolume,
  kosdaqVolume,
  kospiValue,
  kosdaqValue,
  risingKospi,
  risingKosdaq,
  risingCollectedTime,
  onSelect,
  baseTimestamp,
}: TradeRankingProps) {
  return (
    <div className={styles.section}>
      <Tabs defaultValue="kospi-volume" variant="underline">
        <div className={styles.header}>
          <h3 className={styles.heading}>거래 상위</h3>
          {baseTimestamp && (
            <span className={styles.baseTimestamp}>{formatBaseTimestamp(baseTimestamp)}</span>
          )}
        </div>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="kospi-volume">거래량(코스피)</TabsTrigger>
          <TabsTrigger value="kosdaq-volume">거래량(코스닥)</TabsTrigger>
          <TabsTrigger value="kospi-value">거래대금(코스피)</TabsTrigger>
          <TabsTrigger value="kosdaq-value">거래대금(코스닥)</TabsTrigger>
          <TabsTrigger value="rising-kospi">상승(코스피)</TabsTrigger>
          <TabsTrigger value="rising-kosdaq">상승(코스닥)</TabsTrigger>
        </TabsList>

        <TabsContent value="kospi-volume">
          <RankingList stocks={kospiVolume} rankClass={styles.rankBlue} onSelect={onSelect} subKey="volume" />
        </TabsContent>

        <TabsContent value="kosdaq-volume">
          <RankingList stocks={kosdaqVolume} rankClass={styles.rankPurple} onSelect={onSelect} subKey="volume" />
        </TabsContent>

        <TabsContent value="kospi-value">
          <RankingList stocks={kospiValue} rankClass={styles.rankBlue} onSelect={onSelect} subKey="value" />
        </TabsContent>

        <TabsContent value="kosdaq-value">
          <RankingList stocks={kosdaqValue} rankClass={styles.rankPurple} onSelect={onSelect} subKey="value" />
        </TabsContent>

        <TabsContent value="rising-kospi">
          {risingCollectedTime && (
            <p className={styles.baseTimestamp} style={{ marginBottom: "0.5rem" }}>기준 {risingCollectedTime}</p>
          )}
          <RisingList stocks={risingKospi} />
        </TabsContent>

        <TabsContent value="rising-kosdaq">
          {risingCollectedTime && (
            <p className={styles.baseTimestamp} style={{ marginBottom: "0.5rem" }}>기준 {risingCollectedTime}</p>
          )}
          <RisingList stocks={risingKosdaq} />
        </TabsContent>
      </Tabs>
    </div>
  );
});
