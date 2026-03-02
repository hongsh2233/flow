"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "../../components/module/Search";
import { StockTermBox } from "../../components/module/stock-term-box";
import styles from "./StocksSearchPage.module.css";

/* ─────────────────────────────────────────────── 타입 ── */
interface CorpOutlineItem {
  crno?: string;
  corpNm?: string;
  corpEnNm?: string;
  ceoNm?: string;
  bzno?: string;
  enpBsAbgd?: string;
  enpEstbDt?: string;
  adres?: string;
  homePg?: string;
  [key: string]: unknown;
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

  // 기업기본정보
  const [corpInfo, setCorpInfo] = useState<CorpOutlineItem[]>([]);
  const [corpLoading, setCorpLoading] = useState(false);

  // 주가정보
  const [stockDetail, setStockDetail] = useState<FscStockDetail | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

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
      router.replace(`/stocks/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    setSearchTerm(q);
  }, [q]);

  useEffect(() => {
    if (!q.trim()) return;
    const query = q.trim();

    // 기업기본정보 (data.go.kr)
    setCorpLoading(true);
    fetch(`/api/corp-outline?corpNm=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((j) => setCorpInfo(Array.isArray(j.data) ? j.data : []))
      .catch(() => setCorpInfo([]))
      .finally(() => setCorpLoading(false));

    // 주가정보 (FSC)
    setStockLoading(true);
    fetch(`/api/fsc-stock-price?itms_nm=${encodeURIComponent(query)}&limit=1`)
      .then((r) => r.json())
      .then((j) => setStockDetail(Array.isArray(j.data) && j.data.length > 0 ? j.data[0] : null))
      .catch(() => setStockDetail(null))
      .finally(() => setStockLoading(false));

    // 주식권리일정정보
    setRightLoading(true);
    fetch(`/api/right-schedule?stck_issu_cmpy_nm=${encodeURIComponent(query)}&page_no=1&num_of_rows=1000`)
      .then((r) => r.json())
      .then((j) => setRightSchedule(Array.isArray(j.data) ? j.data : []))
      .catch(() => setRightSchedule([]))
      .finally(() => setRightLoading(false));

    // 관련뉴스 (Naver)
    setNewsLoading(true);
    fetch(`/api/naver-news?query=${encodeURIComponent(query + " 주가")}&display=5&sort=date`)
      .then((r) => r.json())
      .then((j) => setNews(Array.isArray(j.data) ? j.data.slice(0, 5) : []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [q]);

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

          {/* 1. 기업기본정보 */}
          <section className={styles.searchSection}>
            <h4 className={styles.searchSectionTitle}>기업기본정보</h4>
            {corpLoading ? (
              <p className={styles.loadingText}>로딩 중...</p>
            ) : corpInfo.length === 0 ? (
              <p className={styles.loadingText}>기업정보를 찾을 수 없습니다.</p>
            ) : (
              <div className={styles.corpCards}>
                {corpInfo.map((corp, idx) => (
                  <div key={idx} className={styles.corpCard}>
                    <div className={styles.corpCardRow}>
                      <span className={styles.corpCardLabel}>법인명</span>
                      <span className={styles.corpCardValue}>{corp.corpNm ?? "-"}</span>
                    </div>
                    {corp.corpEnNm && (
                      <div className={styles.corpCardRow}>
                        <span className={styles.corpCardLabel}>영문명</span>
                        <span className={styles.corpCardValue}>{corp.corpEnNm}</span>
                      </div>
                    )}
                    <div className={styles.corpCardRow}>
                      <span className={styles.corpCardLabel}>대표자</span>
                      <span className={styles.corpCardValue}>{corp.ceoNm ?? "-"}</span>
                    </div>
                    <div className={styles.corpCardRow}>
                      <span className={styles.corpCardLabel}>사업자등록번호</span>
                      <span className={styles.corpCardValue}>{corp.bzno ?? "-"}</span>
                    </div>
                    <div className={styles.corpCardRow}>
                      <span className={styles.corpCardLabel}>법인등록번호</span>
                      <span className={styles.corpCardValue}>{corp.crno ?? "-"}</span>
                    </div>
                    {corp.enpBsAbgd && (
                      <div className={styles.corpCardRow}>
                        <span className={styles.corpCardLabel}>업종</span>
                        <span className={styles.corpCardValue}>{corp.enpBsAbgd}</span>
                      </div>
                    )}
                    {corp.enpEstbDt && (
                      <div className={styles.corpCardRow}>
                        <span className={styles.corpCardLabel}>설립일</span>
                        <span className={styles.corpCardValue}>{corp.enpEstbDt}</span>
                      </div>
                    )}
                    {corp.adres && (
                      <div className={styles.corpCardRow}>
                        <span className={styles.corpCardLabel}>주소</span>
                        <span className={styles.corpCardValue}>{corp.adres}</span>
                      </div>
                    )}
                    {corp.homePg && (
                      <div className={styles.corpCardRow}>
                        <span className={styles.corpCardLabel}>홈페이지</span>
                        <span className={styles.corpCardValue}>
                          <a
                            href={corp.homePg.startsWith("http") ? corp.homePg : `https://${corp.homePg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.corpLink}
                          >
                            {corp.homePg}
                          </a>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. 주가정보 */}
          <section className={styles.searchSection}>
            <h4 className={styles.searchSectionTitle}>주가정보</h4>
            {stockLoading ? (
              <p className={styles.loadingText}>로딩 중...</p>
            ) : !stockDetail ? (
              <p className={styles.loadingText}>주가정보를 불러올 수 없습니다.</p>
            ) : (
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
            )}
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
