"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./MarketSummaryPopup.module.css";

const STORAGE_KEY = "market_summary_hidden_today";

interface IndexItem {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
}

interface ExchangeRateItem {
  currency: string;
  rate: number;
  change: number;
  isPositive: boolean;
}

interface AiSummary {
  usMarket: string;
  krIndices: string;
  exchangeRate: string;
  krFocus: string;
}

interface SummaryData {
  indices: IndexItem[];
  exchangeRates: ExchangeRateItem[];
  collectedDate: string | null;
  aiSummary: AiSummary | null;
}

function getHiddenToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    const now = Date.now();
    return now - ts < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function hideToday() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** 일요일(KST)인지 확인 */
function isSundayKST(): boolean {
  const now = new Date();
  const kr = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kr.getDay() === 0; // 0 = Sunday
}

/** 06:00 ~ 10:00 KST 사이에만 팝업 노출 (06:35 수집 데이터), 일요일 제외 */
function isInDisplayWindow(): boolean {
  if (isSundayKST()) return false;
  const now = new Date();
  const kr = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hour = kr.getHours();
  const min = kr.getMinutes();
  const totalMin = hour * 60 + min;
  const start = 6 * 60; // 06:00
  const end = 10 * 60; // 10:00
  return totalMin >= start && totalMin <= end;
}

export function MarketSummaryPopup() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getHiddenToday() || !isInDisplayWindow()) return;

    fetch("/api/market-morning-summary")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success || !result.data) return;
        const d = result.data as SummaryData;
        const hasData = (d.indices?.length ?? 0) > 0 || (d.exchangeRates?.length ?? 0) > 0;
        if (hasData) {
          setData(d);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleClose = useCallback((todayHide: boolean) => {
    if (todayHide) hideToday();
    setVisible(false);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose(false);
    },
    [handleClose]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) handleClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleClose]);

  if (!visible || !data) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>🌅 아침 시장 요약</h3>
          <button className={styles.closeBtn} onClick={() => handleClose(false)} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {data.aiSummary && (
            <section className={styles.aiSection}>
              {data.aiSummary.usMarket && (
                <div className={styles.aiItem}>
                  <span className={styles.aiLabel}>뉴욕증시</span>
                  <p className={styles.aiText}>{data.aiSummary.usMarket}</p>
                </div>
              )}
              {data.aiSummary.krIndices && (
                <div className={styles.aiItem}>
                  <span className={styles.aiLabel}>한국 관련 지수</span>
                  <p className={styles.aiText}>{data.aiSummary.krIndices}</p>
                </div>
              )}
              {data.aiSummary.exchangeRate && (
                <div className={styles.aiItem}>
                  <span className={styles.aiLabel}>환율</span>
                  <p className={styles.aiText}>{data.aiSummary.exchangeRate}</p>
                </div>
              )}
              {data.aiSummary.krFocus && (
                <div className={styles.aiItem}>
                  <span className={styles.aiLabel}>주목할점</span>
                  <p className={styles.aiText}>{data.aiSummary.krFocus}</p>
                </div>
              )}
            </section>
          )}

          {data.indices && data.indices.length > 0 && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>뉴욕증시 마감 · 선물</h4>
              <ul className={styles.list}>
                {data.indices.map((item) => (
                  <li key={item.symbol} className={styles.item}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemValue}>
                      {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className={item.isPositive ? styles.itemUp : styles.itemDown}>
                      {item.change >= 0 ? "+" : ""}
                      {item.change.toFixed(2)} ({item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.exchangeRates && data.exchangeRates.length > 0 && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>환율</h4>
              <ul className={styles.list}>
                {data.exchangeRates.map((item) => (
                  <li key={item.currency} className={styles.item}>
                    <span className={styles.itemName}>{item.currency}</span>
                    <span className={styles.itemValue}>{item.rate.toLocaleString()}</span>
                    <span className={item.isPositive ? styles.itemUp : styles.itemDown}>
                      {item.change >= 0 ? "+" : ""}
                      {item.change.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.collectedDate && (
            <p className={styles.footerNote}>
              기준일 {data.collectedDate} · 06:35 수집
            </p>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.todayHide}
            onClick={() => handleClose(true)}
          >
            <span className={styles.checkbox}>□</span>
            오늘 하루 보지 않기
          </button>
          <button className={styles.closeText} onClick={() => handleClose(false)}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default MarketSummaryPopup;
