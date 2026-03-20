"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./DailyDigestCard.module.css";

interface MainPostItem {
  id: number;
  board_id: string;
  title: string;
  content: string;
}

function extractYmdFromClosingTitle(title: string): { y: number; m: number; d: number } | null {
  // 예: "외국인 ... | 2026년 3월 12일 마감시황"
  const re = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
  const match = title.match(re);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function stripHtmlToText(html: string): string {
  if (!html) return "";
  // main-posts의 content는 이미 HTML 제거/정리된 상태일 가능성이 높지만,
  // 만약 남아있다면 안전하게 텍스트로 변환한다.
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function extractStrongStocks(text: string): string {
  // closing gemini는 HTML 텍스트로 "상한가 종목" 또는 "상한가" 섹션을 포함.
  const candidates = [
    /상한가 종목[^:\n]*[:\-]?\s*([^\n]+)/,
    /상한가[^:\n]*[:\-]?\s*([^\n]+)/,
  ];
  for (const re of candidates) {
    const m = text.match(re);
    if (m?.[1]) {
      // "A, B, C" 형태로 파싱해 상위 8개만 보여준다.
      const parts = m[1]
        .split(/[,\u00b7·]/g)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) return parts.slice(0, 8).join(", ");
      break;
    }
  }
  return "데이터 없음";
}

function extractTodayTheme(text: string): string {
  // closing gemini의 "오늘 특징" 섹션 본문이 1~2문장으로 들어가며,
  // stripHtmlToText 이후에는 줄바꿈 기반으로 추출하는 게 가장 안전하다.
  const re = /오늘 특징[^]*?\n([^\n]+)/;
  const m = text.match(re);
  if (m?.[1]) {
    const line = m[1].trim();
    return line.length > 0 ? line.slice(0, 60) : "데이터 없음";
  }
  // fallback: "상한가" 키워드 앞부분에서 짧게 잡기
  const idx = text.indexOf("오늘 특징");
  if (idx >= 0) {
    const sub = text.slice(idx, idx + 120).trim();
    return sub.length > 0 ? sub.slice(0, 60) : "데이터 없음";
  }
  return "데이터 없음";
}

function extractKeywords(text: string): string {
  // "증시 키워드"는 구조화 데이터가 없으므로, 현재는 가장 상단의 요약 문장 일부를 사용.
  const firstLine = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)[0];
  if (!firstLine) return "데이터 없음";
  return firstLine.slice(0, 38);
}

export function DailyDigestCard() {
  const [post, setPost] = useState<MainPostItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/main-posts?limit=20", { cache: "no-store" });
        const json = await res.json();
        if (!json?.success || !Array.isArray(json.data)) return;

        // 종목 리포트 게시판 메인 노출 조건:
        // - show_on_main=true 인 게시글들 중
        // - 장마감/시황 포스팅이 저장되는 report board ("B001")만 대상으로 한다.
        const target = json.data.find((p: MainPostItem) => p.board_id === "B001");
        if (!cancelled) setPost(target ?? null);
      } catch {
        if (!cancelled) setPost(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const parsedDate = useMemo(() => (post?.title ? extractYmdFromClosingTitle(post.title) : null), [post?.title]);
  const header = useMemo(() => {
    if (!parsedDate) return "한국 증시 주도섹터 및 내일 관심주";
    return `${parsedDate.y}년 ${parsedDate.m}월 ${parsedDate.d}일 한국 증시 주도섹터 및 내일 관심주`;
  }, [parsedDate]);

  const aiText = useMemo(() => stripHtmlToText(post?.content || ""), [post?.content]);
  const tags = useMemo(() => {
    const keywords = extractKeywords(aiText);
    const theme = extractTodayTheme(aiText);
    const strongStocks = extractStrongStocks(aiText);
    return { keywords, theme, strongStocks };
  }, [aiText]);

  if (loading || !post) return null;

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>📌 {header}</h3>
      </div>

      <div className={styles.cardList}>
        <div className={styles.card}>
          <p className={styles.aiText}>{aiText}</p>

          <div className={styles.tags}>
            <div className={styles.tag}>
              <span className={styles.tagLabel}>증시 키워드</span>
              <span className={styles.tagValue}>{tags.keywords}</span>
            </div>
            <div className={styles.tag}>
              <span className={styles.tagLabel}>주도 테마</span>
              <span className={styles.tagValue}>{tags.theme}</span>
            </div>
            <div className={styles.tag}>
              <span className={styles.tagLabel}>강세종목</span>
              <span className={styles.tagValue}>{tags.strongStocks}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DailyDigestCard;

