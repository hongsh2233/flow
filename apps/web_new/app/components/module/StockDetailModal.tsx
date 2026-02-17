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

interface RightScheduleItem {
  basDt?: string;
  bas_dt?: string;
  stckIssuCmpyNm?: string;
  stck_issu_cmpy_nm?: string;
  rgtExertRcdNm?: string;
  rgt_exert_rcd_nm?: string;
  rgtExertSttgDt?: string;
  rgt_exert_sttg_dt?: string;
  rgtExertEdDt?: string;
  rgt_exert_ed_dt?: string;
  [key: string]: unknown;
}

function getRightScheduleVal(item: RightScheduleItem, ...keys: (keyof RightScheduleItem)[]): string {
  for (const k of keys) {
    const v = item[k];
    if (v != null && v !== "") return String(v);
  }
  return "-";
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
}: StockDetailModalProps) {
  const [detail, setDetail] = useState<FscStockDetail | null>(null);
  const [rightSchedule, setRightSchedule] = useState<RightScheduleItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [rightLoading, setRightLoading] = useState(true);

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

  const loadRightSchedule = useCallback(async () => {
    if (!stock?.name?.trim()) {
      setRightLoading(false);
      return;
    }
    setRightLoading(true);
    try {
      const res = await fetch(`/api/right-schedule?stck_issu_cmpy_nm=${encodeURIComponent(stock.name)}&page_no=1&num_of_rows=1000`);
      const json = await res.json();
      setRightSchedule(Array.isArray(json.data) ? json.data : []);
    } catch {
      setRightSchedule([]);
    } finally {
      setRightLoading(false);
    }
  }, [stock?.name]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    loadRightSchedule();
  }, [loadRightSchedule]);

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
            <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="닫기">
              <X />
            </button>
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
              <div className={styles.infoTableWrap}>
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

          {/* 주식권리일정정보 */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>주식권리일정정보</h4>
            {rightLoading ? (
              <p className={styles.loadingText}>로딩 중...</p>
            ) : rightSchedule.length === 0 ? (
              <p className={styles.loadingText}>조회 결과가 없습니다.</p>
            ) : (
              <div className={styles.infoTableWrap}>
                <table className={styles.infoTable}>
                  <thead>
                    <tr>
                      <th>기준일자</th>
                      <th>발행회사명</th>
                      <th>권리행사사유</th>
                      <th>권리행사시작일</th>
                      <th>권리행사종료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rightSchedule.map((item, idx) => (
                      <tr key={idx}>
                        <td>{getRightScheduleVal(item, "basDt", "bas_dt")}</td>
                        <td>{getRightScheduleVal(item, "stckIssuCmpyNm", "stck_issu_cmpy_nm")}</td>
                        <td>{getRightScheduleVal(item, "rgtExertRcdNm", "rgt_exert_rcd_nm")}</td>
                        <td>{getRightScheduleVal(item, "rgtExertSttgDt", "rgt_exert_sttg_dt")}</td>
                        <td>{getRightScheduleVal(item, "rgtExertEdDt", "rgt_exert_ed_dt")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 관심 추가 */}
          <div className={styles.actionGrid}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => onAddFavorite?.(stock)}
            >
              <Heart aria-hidden />
              관심 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
