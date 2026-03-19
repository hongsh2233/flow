"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "../../components/module/Search";
import { StockTermBox } from "../../components/module/stock-term-box";
import styles from "./StocksSearchPage.module.css";

/* ─────────────────────────────────────────────── 타입 ── */
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

/* ─────────────────────────────────────────── 유틸 ── */
function getCellVal(row: Record<string, unknown>, camelKey: string): string {
  const snake = camelKey.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  return String(row[camelKey] ?? row[snake] ?? "-");
}

function formatMarketCap(val: string | number | undefined): string {
  if (val == null) return "-";
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (Number.isNaN(num)) return "-";
  if (num >= 1e12) return `${Math.floor(num / 1e12)}조`;
  if (num >= 1e8) return `${Math.floor(num / 1e8)}억`;
  return num.toLocaleString();
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

/* ─────────────────────────────────────────── 메인 컴포넌트 ── */
function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";

  const [searchTerm, setSearchTerm] = useState(q);

  // 검색 결과 목록 (동일명 다수 가능)
  const [stockList, setStockList] = useState<FscStockDetail[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // 선택된 종목 (목록에서 클릭 시)
  const [selectedStock, setSelectedStock] = useState<FscStockDetail | null>(null);

  // 주식권리일정정보
  const [rightSchedule, setRightSchedule] = useState<Record<string, unknown>[]>([]);
  const [rightLoading, setRightLoading] = useState(false);

  // 관련뉴스
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const handleSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setSearchTerm(trimmed);
      setSelectedStock(null);
      router.replace(`/stocks/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    setSearchTerm(q);
    setSelectedStock(null);
  }, [q]);

  // 주가 목록 조회
  useEffect(() => {
    if (!q.trim()) return;
    const query = q.trim();
    setStockLoading(true);
    setStockList([]);
    fetch(`/api/fsc-stock-price?itms_nm=${encodeURIComponent(query)}&limit=20`)
      .then((r) => r.json())
      .then((j) => {
        const list: FscStockDetail[] = Array.isArray(j.data) ? j.data : [];
        setStockList(list);
        // 정확히 1건이면 자동 선택
        if (list.length === 1) setSelectedStock(list[0]);
      })
      .catch(() => setStockList([]))
      .finally(() => setStockLoading(false));
  }, [q]);

  // 선택 종목 변경 시 권리일정·뉴스 조회
  useEffect(() => {
    const name = selectedStock?.itms_nm?.trim() ?? q.trim();
    if (!name) return;

    setRightLoading(true);
    fetch(`/api/right-schedule?stck_issu_cmpy_nm=${encodeURIComponent(name)}&page_no=1&num_of_rows=1000`)
      .then((r) => r.json())
      .then((j) => setRightSchedule(Array.isArray(j.data) ? j.data : []))
      .catch(() => setRightSchedule([]))
      .finally(() => setRightLoading(false));

    setNewsLoading(true);
    fetch(`/api/naver-news?query=${encodeURIComponent(name + " 주가")}&display=5&sort=date`)
      .then((r) => r.json())
      .then((j) => setNews(Array.isArray(j.data) ? j.data.slice(0, 5) : []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [selectedStock, q]);

  // 표시할 주가 정보 (선택 or 단일 결과)
  const stockDetail = selectedStock;

  return (
    <div className={styles.page}>
      <Link href="/stocks" className={styles.backLink}>
        ← 종목으로 돌아가기
      </Link>

      <div className={styles.searchArea}>
        <Search
          value={searchTerm}
          onChange={setSearchTerm}
          onSearch={handleSearch}
          placeholder="종목명 검색 (예: 삼성전자)"
        />
      </div>

      {!q ? (
        <p className={styles.loadingText}>종목명을 입력하고 검색 버튼을 눌러 주세요.</p>
      ) : (
        <>
          <p className={styles.searchQueryInfo}>검색어: {q}</p>

          {/* 1. 검색 결과 목록 (다수일 때만 표시) */}
          {stockLoading ? (
            <p className={styles.loadingText}>검색 중...</p>
          ) : stockList.length === 0 ? (
            <p className={styles.loadingText}>검색 결과가 없습니다.</p>
          ) : stockList.length > 1 && !selectedStock ? (
            <section className={styles.searchSection}>
              <h4 className={styles.searchSectionTitle}>
                검색 결과 {stockList.length}건 — 종목을 선택해 주세요
              </h4>
              <div className={styles.stockSelectList}>
                {stockList.map((item, idx) => (
                  <button
                    key={item.srtn_cd ?? idx}
                    type="button"
                    className={styles.stockSelectItem}
                    onClick={() => setSelectedStock(item)}
                  >
                    <span className={styles.stockSelectName}>{item.itms_nm ?? "-"}</span>
                    <span className={styles.stockSelectMeta}>
                      {item.srtn_cd ?? "-"} · {item.mrkt_ctg ?? "-"}
                    </span>
                    <span className={styles.stockSelectPrice}>
                      {Number(String(item.clpr ?? "0").replace(/,/g, "")).toLocaleString()}원
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : stockList.length > 1 && selectedStock ? (
            /* 다수 중 선택한 경우 — 다시 목록으로 버튼 */
            <button
              type="button"
              className={styles.backToListBtn}
              onClick={() => setSelectedStock(null)}
            >
              ← 검색 결과 목록으로
            </button>
          ) : null}

          {/* 2. 주가정보 (선택된 종목 or 단일 결과) */}
          {stockDetail && (
            <>
              <section className={styles.searchSection}>
                <h4 className={styles.searchSectionTitle}>주가정보</h4>
                <div className={styles.tableScrollWrap}>
                  <table className={styles.infoTable}>
                    <tbody>
                      {STOCK_INFO_COLUMNS.map(({ key, label }) => {
                        let val: string | number = stockDetail[key] ?? "-";
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
              </section>

              {/* 3. 주식권리일정정보 */}
              <section className={styles.searchSection}>
                <h4 className={styles.searchSectionTitle}>주식권리일정정보</h4>
                {rightLoading ? (
                  <p className={styles.loadingText}>로딩 중...</p>
                ) : rightSchedule.length === 0 ? (
                  <p className={styles.loadingText}>조회 결과가 없습니다.</p>
                ) : (
                  <div className={styles.tableScrollWrap}>
                    <table className={styles.searchTable}>
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
                        {rightSchedule.slice(0, 20).map((row, idx) => (
                          <tr key={idx}>
                            <td>{getCellVal(row, "basDt")}</td>
                            <td>{getCellVal(row, "stckIssuCmpyNm")}</td>
                            <td>{getCellVal(row, "rgtExertRcdNm")}</td>
                            <td>{getCellVal(row, "rgtExertSttgDt")}</td>
                            <td>{getCellVal(row, "rgtExertEdDt")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* 4. 관련뉴스 */}
              <section className={styles.searchSection}>
                <h4 className={styles.searchSectionTitle}>관련뉴스</h4>
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
            </>
          )}
        </>
      )}

      <StockTermBox wrapperStyle={{ margin: "0 0 1rem" }} />
    </div>
  );
}

export default function StocksSearchPage() {
  return (
    <Suspense fallback={<p className={styles.loadingText}>로딩 중...</p>}>
      <SearchResultsContent />
    </Suspense>
  );
}
