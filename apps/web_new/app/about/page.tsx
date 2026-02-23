"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "./About.module.css";

const FALLBACK_CONTENT = `주린이는 주식 투자를 처음 시작하는 분들을 위한 쉽고 친절한 주식 정보 앱입니다.

주요 기능
- 오늘의 시장: 실시간 국내/해외 지수, 환율 정보를 한눈에 확인
- 일정 캘린더: 실적 발표, 공모 청약, 배당일 등 주요 일정 알림
- 주식 용어 사전: 어려운 주식 용어를 쉽게 풀어서 설명
- 커뮤니티: 주린이들끼리 정보 공유 및 질문`;

export default function AboutPage() {
  const router = useRouter();
  const [content, setContent] = useState(FALLBACK_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/legal-documents/about")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.content) setContent(json.content);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="content__wrap">
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.topBarTitle}>주린이 앱</h2>
          <div className={styles.topBarSpacer} />
        </div>

        <div className={styles.body}>
          <div className={styles.heroCard}>
            <div className={styles.appIcon}>📈</div>
            <h1 className={styles.appName}>주린이</h1>
            <p className={styles.appVersion}>v1.0.0</p>
          </div>

          {loading ? (
            <div className={styles.loadingWrap}>불러오는 중...</div>
          ) : (
            <div className={styles.contentCard}>
              <pre className={styles.contentText}>{content}</pre>
            </div>
          )}

          <p className={styles.copyright}>
            &copy; 2026 Jurini Stock. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
