"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "../../components/module/Search";
import { StockTermBox } from "../../components/module/stock-term-box";
import styles from "./StocksSearchPage.module.css";

function getCellVal(row: Record<string, unknown>, camelKey: string): string {
  const snake = camelKey.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  return String(row[camelKey] ?? row[snake] ?? "-");
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";

  const [searchTerm, setSearchTerm] = useState(q);
  const [searchRightSchedule, setSearchRightSchedule] = useState<Record<string, unknown>[]>([]);
  const [searchLnbDetail, setSearchLnbDetail] = useState<Record<string, unknown>[]>([]);
  const [searchLnbProgress, setSearchLnbProgress] = useState<Record<string, unknown>[]>([]);
  const [searchLnbInvpn, setSearchLnbInvpn] = useState<Record<string, unknown>[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
    const load = async () => {
      setSearchLoading(true);
      const query = q.trim();
      try {
        const [rightRes, lnbDetailRes, lnbProgressRes, lnbInvpnRes] = await Promise.all([
          fetch(`/api/right-schedule?stck_issu_cmpy_nm=${encodeURIComponent(query)}&page_no=1&num_of_rows=1000`),
          fetch(`/api/stck-lnb-detail?itms_nm=${encodeURIComponent(query)}&num_of_rows=100`),
          fetch(`/api/stck-lnb-progress?itms_nm=${encodeURIComponent(query)}&num_of_rows=100`),
          fetch(`/api/stck-lnb-invpn-detail?itms_nm=${encodeURIComponent(query)}&num_of_rows=100`),
        ]);
        const rightJson = await rightRes.json();
        const lnbDetailJson = await lnbDetailRes.json();
        const lnbProgressJson = await lnbProgressRes.json();
        const lnbInvpnJson = await lnbInvpnRes.json();
        setSearchRightSchedule(Array.isArray(rightJson.data) ? rightJson.data : []);
        setSearchLnbDetail(Array.isArray(lnbDetailJson.data) ? lnbDetailJson.data : []);
        setSearchLnbProgress(Array.isArray(lnbProgressJson.data) ? lnbProgressJson.data : []);
        setSearchLnbInvpn(Array.isArray(lnbInvpnJson.data) ? lnbInvpnJson.data : []);
      } catch {
        setSearchRightSchedule([]);
        setSearchLnbDetail([]);
        setSearchLnbProgress([]);
        setSearchLnbInvpn([]);
      } finally {
        setSearchLoading(false);
      }
    };
    load();
  }, [q]);

  const renderSearchTable = (
    title: string,
    data: Record<string, unknown>[],
    keys: { key: string; label: string }[]
  ) => {
    if (!data || data.length === 0) return null;
    return (
      <section className={styles.searchSection}>
        <h4 className={styles.searchSectionTitle}>{title}</h4>
        <div className={styles.tableScrollWrap}>
          <table className={styles.searchTable}>
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k.key}>{k.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((row, idx) => (
                <tr key={idx}>
                  {keys.map((k) => (
                    <td key={k.key}>{getCellVal(row, k.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const hasAnyData =
    searchRightSchedule.length > 0 ||
    searchLnbDetail.length > 0 ||
    searchLnbProgress.length > 0 ||
    searchLnbInvpn.length > 0;

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
      ) : searchLoading ? (
        <p className={styles.loadingText}>검색 중...</p>
      ) : (
        <>
          <p className={styles.searchQueryInfo}>검색어: {q}</p>
          {renderSearchTable("주식권리일정정보", searchRightSchedule, [
            { key: "basDt", label: "기준일자" },
            { key: "stckIssuCmpyNm", label: "발행회사명" },
            { key: "rgtExertRcdNm", label: "권리행사사유" },
            { key: "rgtExertSttgDt", label: "권리행사시작일" },
            { key: "rgtExertEdDt", label: "권리행사종료일" },
          ])}
          {renderSearchTable("대차거래내역", searchLnbDetail, [
            { key: "basDt", label: "기준일자" },
            { key: "stckItmsNm", label: "종목명" },
            { key: "stckItmsCd", label: "종목코드" },
            { key: "mrktClsfNm", label: "시장구분" },
            { key: "balnStckCnt", label: "잔고주식수" },
            { key: "lnbBalAmt", label: "대차잔고금액" },
          ])}
          {renderSearchTable("대차거래추이", searchLnbProgress, [
            { key: "basDt", label: "기준일자" },
            { key: "stckItmsNm", label: "종목명" },
            { key: "stckItmsCd", label: "종목코드" },
            { key: "lnbTrVol", label: "대차거래량" },
            { key: "lnbTrAmt", label: "대차거래금액" },
            { key: "lnbBalQty", label: "대차잔고수량" },
          ])}
          {renderSearchTable("참여자별 대차거래내역", searchLnbInvpn, [
            { key: "basDt", label: "기준일자" },
            { key: "stckItmsNm", label: "종목명" },
            { key: "invpnNm", label: "참여자명" },
            { key: "invpnClsfNm", label: "참여자구분" },
            { key: "lnbCclStckCnt", label: "대차체결주식수" },
          ])}
          {!hasAnyData && <p className={styles.loadingText}>검색 결과가 없습니다.</p>}
        </>
      )}
      <div style={{ marginTop: "1.5rem" }}>
        <StockTermBox />
      </div>
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
