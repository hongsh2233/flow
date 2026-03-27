"use client";

import { X, TrendingUp, TrendingDown, Heart } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { StockDetailModalProps } from "@/lib/types";
import styles from "./StockDetailModal.module.css";

function formatBasDt(basDt: string | undefined): string {
  if (!basDt || basDt.length !== 8) return "";
  const y = basDt.slice(0, 4);
  const m = parseInt(basDt.slice(4, 6), 10);
  const d = parseInt(basDt.slice(6, 8), 10);
  return `${m}월 ${d}일`;
}

function formatMarketCap(val: string | number | undefined): string {
  if (val == null) return "-";
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (Number.isNaN(num)) return "-";
  if (num >= 1e12) return `${Math.floor(num / 1e12)}조`;
  if (num >= 1e8) return `${Math.floor(num / 1e8)}억`;
  return num.toLocaleString();
}

interface FscStockDetail {
  bas_dt?: string;
  srtn_cd?: string;
  isin_cd?: string;
  itms_nm?: string;
  mrkt_ctg?: string;
  clpr?: string;
  vs?: string;
  flt_rt?: string;
  mkp?: string;
  hipr?: string;
  lopr?: string;
  trqu?: string;
  tr_prc?: string;
  lstg_st_cnt?: string;
  mrkt_tot_amt?: string;
}

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function formatPubDate(pubDate: string): string {
  try {
    return new Date(pubDate).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return pubDate;
  }
}

const STOCK_INFO_COLUMNS: { key: keyof FscStockDetail; label: string }[] = [
  { key: "bas_dt", label: "기준일자" },
  { key: "srtn_cd", label: "단축코드" },
  { key: "isin_cd", label: "ISIN코드" },
  { key: "itms_nm", label: "종목명" },
  { key: "mrkt_ctg", label: "시장구분" },
  { key: "clpr", label: "종가" },
  { key: "vs", label: "대비" },
  { key: "flt_rt", label: "등락율(%)" },
  { key: "mkp", label: "시가" },
  { key: "hipr", label: "고가" },
  { key: "lopr", label: "저가" },
  { key: "trqu", label: "거래량" },
  { key: "tr_prc", label: "거래대금" },
  { key: "lstg_st_cnt", label: "상장주식수" },
  { key: "mrkt_tot_amt", label: "시가총액" },
];

export function StockDetailModal({
  stock,
  onClose,
  onAddFavorite,
  onRemoveFavorite,
  isFavorited = false,
}: StockDetailModalProps) {
  const [detail, setDetail] = useState<FscStockDetail | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!stock?.code) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/fsc-stock-price?srtn_cd=${encodeURIComponent(stock.code)}&limit=1`);
      const json = await res.json();
      const data = json.data ?? [];
      const first = data[0];
      setDetail(first ?? null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [stock?.code]);

  const loadNews = useCallback(async () => {
    if (!stock?.name?.trim()) {
      setNewsLoading(false);
      return;
    }
    setNewsLoading(true);
    try {
      const res = await fetch(
        `/api/naver-news?query=${encodeURIComponent(stock.name + " 주가")}&display=5&sort=date`
      );
      const json = await res.json();
      setNews(Array.isArray(json.data) ? json.data.slice(0, 5) : []);
    } catch {
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  }, [stock?.name]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    if (stock) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [stock]);

  if (!stock) return null;

  const price = detail ? parseFloat(String(detail.clpr ?? 0).replace(/,/g, "")) || stock.price : stock.price;
  const change = detail
    ? parseFloat(String(detail.flt_rt ?? 0).replace(/[%,+]/g, "")) || stock.change
    : stock.change;
  const isPositive = change >= 0;
  const dateLabel = formatBasDt(detail?.bas_dt);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.titleArea}>
              <h2 id="stock-modal-title">{stock.name}</h2>
              <p>{stock.code}</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.favBtnTop}
                onClick={() =>
                  isFavorited ? onRemoveFavorite?.(stock) : onAddFavorite?.(stock)
                }
                aria-label={isFavorited ? "관심해제" : "관심 추가"}
              >
                <Heart aria-hidden fill={isFavorited ? "currentColor" : "none"} />
                {isFavorited ? "관심해제" : "관심 추가"}
              </button>
              <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="닫기">
                <X />
              </button>
            </div>
          </div>

          <div className={styles.priceCard}>
            <div className={styles.priceCardTop}>
              <div>
                <p className={styles.priceCardLabel}>
                  {detailLoading ? "로딩 중..." : dateLabel ? `${dateLabel} 종가` : "종가"}
                </p>
                <p className={styles.priceValue}>{price.toLocaleString()}원</p>
              </div>
              {isPositive ? (
                <TrendingUp className={styles.trendIcon} aria-hidden />
              ) : (
                <TrendingDown className={styles.trendIcon} aria-hidden />
              )}
            </div>
            <div className={styles.changeRow}>
              <span className={styles.changeValue}>
                {isPositive ? "+" : ""}
                {change}%
              </span>
              <span className={styles.changeLabel}>전일 대비</span>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          {/* 주가정보 */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>주가정보</h4>
            {detailLoading ? (
              <p className={styles.loadingText}>로딩 중...</p>
            ) : detail ? (
              <div className={styles.tableScrollWrap}>
                <table className={styles.infoTable}>
                  <tbody>
                    {STOCK_INFO_COLUMNS.map(({ key, label }) => {
                      let val: string | number = detail[key] ?? "-";
                      if (key === "mrkt_tot_amt") val = formatMarketCap(val);
                      return (
                        <tr key={key}>
                          <th>{label}</th>
                          <td>{String(val)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.loadingText}>주가정보를 불러올 수 없습니다.</p>
            )}
          </section>

          {/* 관련뉴스 5개 */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>관련뉴스</h4>
            {newsLoading ? (
              <p className={styles.loadingText}>로딩 중...</p>
            ) : news.length === 0 ? (
              <p className={styles.loadingText}>관련 뉴스를 찾을 수 없습니다.</p>
            ) : (
              <div className={styles.newsList}>
                {news.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.newsCard}
                  >
                    <p className={styles.newsTitle}>{item.title}</p>
                    {item.description && (
                      <p className={styles.newsDesc}>{item.description}</p>
                    )}
                    <p className={styles.newsDate}>{formatPubDate(item.pubDate)}</p>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
