"use client";

import { useState, useEffect, useCallback } from "react";
import { NewsList } from "./NewsList";
import { getStockName } from "@/lib/data/stockCodeMap";
import { fetchFscStockPrice } from "@/lib/services/fscService";
import type { NewsItem } from "./AllNews";
import styles from "./News.module.css";

interface FavoriteStock {
  code: string;
  name: string;
}

/** FSC API에서 종목코드 → 종목명 맵 생성 */
async function buildCodeNameMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const res = await fetchFscStockPrice({ limit: 1000 });
    if (res.success && res.data) {
      for (const item of res.data) {
        if (item.srtn_cd && item.itms_nm) {
          map[item.srtn_cd] = item.itms_nm;
        }
      }
    }
  } catch {
    // FSC 실패 시 빈 맵 반환 → 정적 맵 폴백
  }
  return map;
}

export function FavoriteNews() {
  const [stocks, setStocks] = useState<FavoriteStock[]>([]);
  const [newsByStock, setNewsByStock] = useState<Record<string, NewsItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    try {
      // 관심종목 코드 조회 + FSC 종목명 맵 병렬 로딩
      const [favRes, fscMap] = await Promise.all([
        fetch("/api/auth/favorites").then((r) => r.json()),
        buildCodeNameMap(),
      ]);

      if (favRes.success && Array.isArray(favRes.favorite_stocks)) {
        const codes = favRes.favorite_stocks as string[];
        setStocks(
          codes.map((code) => ({
            code,
            // FSC API 우선 → 정적 맵 폴백 → 코드 그대로
            name: fscMap[code] || getStockName(code) || code,
          }))
        );
      } else {
        setStocks([]);
      }
    } catch (err) {
      console.error("관심종목 조회 오류:", err);
      setError("관심종목을 불러오는데 실패했습니다.");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    if (stocks.length === 0) return;

    const fetchNewsForStocks = async () => {
      setLoading(true);
      setError(null);
      const results: Record<string, NewsItem[]> = {};

      await Promise.all(
        stocks.map(async (stock) => {
          try {
            const res = await fetch(
              `/api/naver-news?query=${encodeURIComponent(stock.name + " 주가")}&display=5&sort=date`
            );
            const data = await res.json();
            if (data.success && data.data) {
              results[stock.code] = data.data;
            } else {
              results[stock.code] = [];
            }
          } catch {
            results[stock.code] = [];
          }
        })
      );

      setNewsByStock(results);
      setLoading(false);
    };

    fetchNewsForStocks();
  }, [stocks]);

  // 종목명 맵 (NewsList에 전달)
  const codeNameMap: Record<string, string> = {};
  for (const s of stocks) codeNameMap[s.code] = s.name;

  // 전체 뉴스 병합 + 링크 기준 중복 제거 + 날짜순 정렬
  const seen = new Set<string>();
  const allNews = Object.entries(newsByStock)
    .flatMap(([code, items]) =>
      items.map((item) => ({ ...item, stockCode: code, stockName: codeNameMap[code] }))
    )
    .filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });
  const byDate = [...allNews].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  if (loading && stocks.length === 0) {
    return <div className={styles.loading}>관심종목 뉴스를 불러오는 중...</div>;
  }

  if (stocks.length === 0 && !loading) {
    return (
      <div className={styles.empty}>
        <p>등록된 관심종목이 없습니다.</p>
        <p className={styles.emptySub}>
          종목 페이지에서 관심종목을 등록한 후 뉴스를 확인하세요.
        </p>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (loading) {
    return <div className={styles.loading}>뉴스를 불러오는 중...</div>;
  }

  if (byDate.length === 0) {
    return (
      <div className={styles.empty}>
        관심종목 관련 뉴스가 없습니다.
      </div>
    );
  }

  return <NewsList items={byDate} />;
}
