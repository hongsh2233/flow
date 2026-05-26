"use client";

import { useEffect, useState } from "react";
import styles from "./AdrIndicatorCard.module.css";

interface AdrData {
  date: string;
  market: string;
  adr_value: number | null;
  status: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | "NO_DATA";
  advancing: number;
  declining: number;
  unchanged: number;
  sum_adv_20d: number;
  sum_dec_20d: number;
  data_points: number;
}

interface AdrResponse {
  success: boolean;
  data?: {
    kospi: AdrData;
    kosdaq: AdrData;
  };
  message?: string;
}

function getStatusBadgeStyle(status: string): { color: string; bg: string } {
  switch (status) {
    case "OVERBOUGHT":
      return { color: "#dc2626", bg: "#fee2e2" }; // 빨강 (과열)
    case "OVERSOLD":
      return { color: "#16a34a", bg: "#dcfce7" }; // 초록 (침체/기회)
    case "NEUTRAL":
      return { color: "#ca8a04", bg: "#fef3c7" }; // 노랑 (보통)
    default:
      return { color: "#6b7280", bg: "#f3f4f6" }; // 회색
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "OVERBOUGHT":
      return "과열";
    case "OVERSOLD":
      return "침체";
    case "NEUTRAL":
      return "보통";
    default:
      return "데이터 없음";
  }
}

export function AdrIndicatorCard() {
  const [activeMarket, setActiveMarket] = useState<"kospi" | "kosdaq">("kospi");
  const [adrData, setAdrData] = useState<AdrResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdr = async () => {
      try {
        const response = await fetch("/api/adr-indicator", { cache: "no-store" });
        if (response.ok) {
          const data: AdrResponse = await response.json();
          setAdrData(data);
        }
      } catch (error) {
        console.error("ADR 지표 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdr();
  }, []);

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (!adrData?.data) {
    return (
      <div className={styles.card}>
        <div className={styles.error}>ADR 데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  const currentData = adrData.data[activeMarket];
  const statusStyle = getStatusBadgeStyle(currentData.status);
  const statusLabel = getStatusLabel(currentData.status);

  // 바 그래프 데이터 계산 (백분율)
  const total = currentData.advancing + currentData.declining + currentData.unchanged;
  const advPct = total > 0 ? (currentData.advancing / total) * 100 : 0;
  const unchPct = total > 0 ? (currentData.unchanged / total) * 100 : 0;
  const decPct = total > 0 ? (currentData.declining / total) * 100 : 0;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          상승률 (ADR)
          <div className={styles.description}>20일 이동평균</div>
        </div>

        {/* 시장 선택 탭 */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeMarket === "kospi" ? styles.active : ""}`}
            onClick={() => setActiveMarket("kospi")}
          >
            코스피
          </button>
          <button
            className={`${styles.tab} ${activeMarket === "kosdaq" ? styles.active : ""}`}
            onClick={() => setActiveMarket("kosdaq")}
          >
            코스닥
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* 바 그래프 */}
        <div className={styles.barContainer}>
          <div className={styles.barRow}>
            {advPct > 0 && <div className={styles.barSegment} style={{ width: `${advPct}%`, backgroundColor: "#16a34a" }} />}
            {unchPct > 0 && <div className={styles.barSegment} style={{ width: `${unchPct}%`, backgroundColor: "#d1d5db" }} />}
            {decPct > 0 && <div className={styles.barSegment} style={{ width: `${decPct}%`, backgroundColor: "#dc2626" }} />}
          </div>

          {/* 범례 */}
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: "#16a34a" }} />
              상승 {currentData.advancing}
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: "#d1d5db" }} />
              보합 {currentData.unchanged}
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: "#dc2626" }} />
              하락 {currentData.declining}
            </div>
          </div>
        </div>

        {/* ADR 수치 및 상태 */}
        <div className={styles.adrValue}>
          {currentData.adr_value !== null ? (
            <>
              <div className={styles.value}>{currentData.adr_value.toFixed(1)}</div>
              <div
                className={styles.statusBadge}
                style={{
                  color: statusStyle.color,
                  backgroundColor: statusStyle.bg,
                }}
              >
                {statusLabel}
              </div>
            </>
          ) : (
            <div className={styles.noData}>데이터 없음</div>
          )}
        </div>

        {/* 해석 텍스트 */}
        <div className={styles.interpretation}>
          {currentData.adr_value !== null && currentData.adr_value >= 120 && (
            <p>시장이 과열 상태입니다. 곧 조정이 올 가능성이 있습니다.</p>
          )}
          {currentData.adr_value !== null && currentData.adr_value <= 75 && (
            <p>시장이 침체 상태입니다. 반등 기회가 가까워질 수 있습니다.</p>
          )}
          {currentData.adr_value !== null && currentData.adr_value > 75 && currentData.adr_value < 120 && (
            <p>시장이 균형 상태입니다. 정상적인 변동성을 보이고 있습니다.</p>
          )}
        </div>

        {/* 데이터 정보 */}
        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>20일 합계:</span>
            <span>상승 {currentData.sum_adv_20d} | 하락 {currentData.sum_dec_20d}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>기준일:</span>
            <span>{currentData.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdrIndicatorCard;
