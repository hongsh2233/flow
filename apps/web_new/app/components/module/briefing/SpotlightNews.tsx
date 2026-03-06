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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchNews() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/naver-stock-news?limit=50");
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setNews((data.data as StockNewsItem[]).map(toNewsItem));
        } else {
          setError(data.message || "뉴스를 가져오는데 실패했습니다.");
        }
      } catch {
        if (!cancelled) setError("뉴스를 가져오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchNews();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.allNews}>
      {loading && <div className={styles.loading}>뉴스를 불러오는 중...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && news.length === 0 && (
        <div className={styles.empty}>재료 뉴스가 없습니다.</div>
      )}
      {!loading && !error && news.length > 0 && <NewsList items={news} />}
    </div>
  );
}
