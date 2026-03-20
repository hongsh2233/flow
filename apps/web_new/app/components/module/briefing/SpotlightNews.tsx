"use client";

import { useState, useEffect } from "react";
import { NewsList } from "../news/NewsList";
import type { NewsItem } from "../news/AllNews";
import styles from "../news/News.module.css";

interface StockNewsItem {
  id: number;
  category: string;
  keyword: string;
  title: string;
  description: string | null;
  link: string;
  pub_date: string | null;
  pub_datetime: string | null;
  collected_at: string | null;
}

function toNewsItem(item: StockNewsItem): NewsItem & { stockName?: string } {
  return {
    title: item.title,
    originallink: item.link,
    link: item.link,
    description: item.description ?? "",
    pubDate: item.pub_datetime ?? item.pub_date ?? item.collected_at ?? "",
    stockName: item.category,
  };
}

export function SpotlightNews() {
  const [news, setNews] = useState<(NewsItem & { stockName?: string })[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [newsRes, summaryRes] = await Promise.all([
          fetch("/api/naver-stock-news?limit=50"),
          fetch("/api/daily-issue-summary"),
        ]);
        if (cancelled) return;

        const newsData = await newsRes.json();
        if (newsData.success && newsData.data) {
          setNews((newsData.data as StockNewsItem[]).map(toNewsItem));
        } else {
          setError(newsData.message || "뉴스를 가져오는데 실패했습니다.");
        }

        const summaryData = await summaryRes.json();
        if (summaryData.success && summaryData.summary) {
          setSummary(summaryData.summary);
        }
      } catch {
        if (!cancelled) setError("뉴스를 가져오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.allNews}>
      {loading && <div className={styles.loading}>뉴스를 불러오는 중...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && summary && (
        <section className={styles.issueSummaryCard}>
          <button
            type="button"
            className={styles.issueSummaryHeader}
            onClick={() => setSummaryExpanded((v) => !v)}
            aria-expanded={summaryExpanded}
          >
            <h3 className={styles.issueSummaryTitle}>📌 AI요약</h3>
            <span className={styles.expandIcon}>
              {summaryExpanded ? "▲ 접기" : "▼ 더보기"}
            </span>
          </button>
          <div
            className={`${styles.issueSummaryBodyWrap} ${summaryExpanded ? styles.expanded : ""}`}
          >
            <p className={styles.issueSummaryBody}>{summary}</p>
          </div>
        </section>
      )}
      {!loading && !error && news.length === 0 && (
        <div className={styles.empty}>이슈 뉴스가 없습니다.</div>
      )}
      {!loading && !error && news.length > 0 && <NewsList items={news} />}
    </div>
  );
}
