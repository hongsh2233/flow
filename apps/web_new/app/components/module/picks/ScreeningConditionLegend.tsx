"use client";

import { useState } from "react";
import styles from "./Picks.module.css";

type Props = { screeningType: "ichimoku" | "jongbe" };

export function ScreeningConditionLegend({ screeningType }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" className={styles.legendToggle} onClick={() => setOpen((o) => !o)}>
        {open ? "▼ 조건 범례 숨기기" : "▶ 조건 범례 보기"}
      </button>
      {open && (
        <div className={styles.legendBox}>
          {screeningType === "ichimoku" ? (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>A: 전환선 &gt; 기준선</li>
              <li>B: 주가 &gt; 기준선</li>
              <li>E: 주가 &gt; 구름대 위</li>
              <li>G: 기준선 상승</li>
              <li>J: 120봉 신고가</li>
            </ul>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>A: 시총 500억↑</li>
              <li>B: 거래대금 상위</li>
              <li>C: 등락률 +1~+10%</li>
              <li>D: 양봉</li>
              <li>E: 고가 대비 98%↑</li>
              <li>F: 5MA 위</li>
              <li>G: RSI(14) 50↑</li>
              <li>H: 전일 거래량 비율 200%↑</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
