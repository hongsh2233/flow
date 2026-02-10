"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import type { TradeRankingProps, VolumeStock, ValueStock } from "@/lib/types";
import type { StockDetail } from "@/lib/types";
import styles from "./TradeRanking.module.css";

function VolumeList({
  stocks,
  rankClass,
  onSelect,
}: {
  stocks: VolumeStock[];
  rankClass: string;
  onSelect: (stock: StockDetail) => void;
}) {
  return (
    <div className={styles.list}>
      {stocks.map((stock) => {
        const isPositive = stock.change >= 0;
        return (
          <button
            key={stock.rank}
            type="button"
            onClick={() =>
              onSelect({
                name: stock.name,
                code: stock.code,
                price: stock.price,
                change: stock.change,
                volume: stock.volume,
              })
            }
            className={styles.card}
          >
            <div className={styles.cardInner}>
              <span className={rankClass}>{stock.rank}</span>
              <div className={styles.info}>
                <h4 className={styles.stockName}>{stock.name}</h4>
                <p className={styles.stockSub}>{stock.volume}</p>
              </div>
              <div className={styles.priceArea}>
                <p className={styles.price}>
                  {stock.price.toLocaleString()}
                </p>
                <p
                  className={`${styles.changeText} ${
                    isPositive ? styles.changeUp : styles.changeDown
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {stock.change}%
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ValueList({
  stocks,
  rankClass,
  onSelect,
}: {
  stocks: ValueStock[];
  rankClass: string;
  onSelect: (stock: StockDetail) => void;
}) {
  return (
    <div className={styles.list}>
      {stocks.map((stock) => {
        const isPositive = stock.change >= 0;
        return (
          <button
            key={stock.rank}
            type="button"
            onClick={() =>
              onSelect({
                name: stock.name,
                code: "",
                price: stock.price,
                change: stock.change,
              })
            }
            className={styles.card}
          >
            <div className={styles.cardInner}>
              <span className={rankClass}>{stock.rank}</span>
              <div className={styles.info}>
                <h4 className={styles.stockName}>{stock.name}</h4>
                <p className={styles.stockSub}>{stock.value}</p>
              </div>
              <div className={styles.priceArea}>
                <p className={styles.price}>
                  {stock.price.toLocaleString()}
                </p>
                <p
                  className={`${styles.changeText} ${
                    isPositive ? styles.changeUp : styles.changeDown
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {stock.change}%
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TradeRanking({
  kospiVolume,
  kosdaqVolume,
  kospiValue,
  kosdaqValue,
  onSelect,
}: TradeRankingProps) {
  return (
    <div className={styles.section}>
      <Tabs defaultValue="kospi-volume" variant="underline">
        <div className={styles.header}>
          <h3 className={styles.heading}>거래 상위</h3>
        </div>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="kospi-volume">
            거래량(코스피)
          </TabsTrigger>
          <TabsTrigger value="kosdaq-volume">
            거래량(코스닥)
          </TabsTrigger>
          <TabsTrigger value="kospi-value">
            거래대금(코스피)
          </TabsTrigger>
          <TabsTrigger value="kosdaq-value">
            거래대금(코스닥)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kospi-volume">
          <VolumeList
            stocks={kospiVolume}
            rankClass={styles.rankBlue}
            onSelect={onSelect}
          />
        </TabsContent>

        <TabsContent value="kosdaq-volume">
          <VolumeList
            stocks={kosdaqVolume}
            rankClass={styles.rankPurple}
            onSelect={onSelect}
          />
        </TabsContent>

        <TabsContent value="kospi-value">
          <ValueList
            stocks={kospiValue}
            rankClass={styles.rankBlue}
            onSelect={onSelect}
          />
        </TabsContent>

        <TabsContent value="kosdaq-value">
          <ValueList
            stocks={kosdaqValue}
            rankClass={styles.rankPurple}
            onSelect={onSelect}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
