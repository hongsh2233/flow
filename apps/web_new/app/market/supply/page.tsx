"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import styles from "./SupplyPage.module.css";

interface TableData {
  headers: string[];
  rows: string[][];
}

interface SupplyResponse {
  success: boolean;
  data: TableData | null;
  bizdate: string | null;
  collected_time?: string | null;
}

type Market = "kospi" | "kosdaq";

type MainTab = "investor" | "deal" | "program";

async function fetchTable(params: URLSearchParams): Promise<SupplyResponse> {
  async function request(p: URLSearchParams): Promise<SupplyResponse> {
    const res = await fetch(`/api/naver-supply?${p.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      return { success: false, data: null, bizdate: null };
    }
    return res.json();
  }

  // 1차: 요청한 market (예: kospi / kosdaq)
  const primary = await request(params);
  const market = params.get("market");

  // 데이터가 있거나, market이 all 이면 그대로 반환
  if ((primary.success && primary.data) || !market || market === "all") {
    return primary;
  }

  // 2차: 같은 data_type으로 market=all 로 폴백 (admin/naver-ranking JS와 동일 전략)
  const fallbackParams = new URLSearchParams(params);
  fallbackParams.set("market", "all");
  return request(fallbackParams);
}

function Table({ data }: { data: TableData }) {
  if (!data.rows.length) {
    return <p className={styles.empty}>데이터가 없습니다.</p>;
  }
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {data.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, i) => {
                const isMinus = i > 0 && String(cell).trim().startsWith("-");
                const isPlus = i > 0 && String(cell).trim().startsWith("+");
                const cls = isMinus ? styles.down : isPlus ? styles.up : undefined;
                return (
                  <td key={i} className={cls}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestorTable({ data }: { data: TableData }) {
  if (!data.rows.length) {
    return <p className={styles.empty}>데이터가 없습니다.</p>;
  }
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.investorHeadMain}>
            <th rowSpan={2} className={styles.investorHeadFirst}>
              날짜
            </th>
            <th rowSpan={2}>개인</th>
            <th rowSpan={2}>외국인</th>
            <th rowSpan={2}>기관계</th>
            <th colSpan={6} className={styles.investorHeadGroup}>
              기관
            </th>
            <th rowSpan={2}>기타법인</th>
          </tr>
          <tr className={styles.investorHeadSub}>
            <th className={styles.investorHeadSubCell}>금융투자</th>
            <th className={styles.investorHeadSubCell}>보험</th>
            <th className={styles.investorHeadSubCell}>투신(사모)</th>
            <th className={styles.investorHeadSubCell}>은행</th>
            <th className={styles.investorHeadSubCell}>기타금융기관</th>
            <th className={styles.investorHeadSubCell}>연기금등</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, i) => {
                const isMinus = i > 0 && String(cell).trim().startsWith("-");
                const isPlus = i > 0 && String(cell).trim().startsWith("+");
                const cls = isMinus ? styles.down : isPlus ? styles.up : undefined;
                return (
                  <td key={i} className={cls}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SupplyPage() {
  const [mainTab, setMainTab] = useState<MainTab>("investor");
  const [market, setMarket] = useState<Market>("kospi");

  const [investorData, setInvestorData] = useState<Record<Market, SupplyResponse | null>>({
    kospi: null,
    kosdaq: null,
  });
  const [programData, setProgramData] = useState<Record<Market, SupplyResponse | null>>({
    kospi: null,
    kosdaq: null,
  });
  const [dealData, setDealData] = useState<Record<Market, Record<string, SupplyResponse | null>>>({
    kospi: { foreign_buy: null, foreign_sell: null, inst_buy: null, inst_sell: null },
    kosdaq: { foreign_buy: null, foreign_sell: null, inst_buy: null, inst_sell: null },
  });

  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const key = `${mainTab}-${market}`;
    if (fetchedRef.current.has(key)) return;

    async function load() {
      setLoading(true);
      try {
        if (mainTab === "investor") {
          fetchedRef.current.add(key);
          const params = new URLSearchParams({ data_type: "investor_day", market });
          const json = await fetchTable(params);
          setInvestorData((prev) => ({ ...prev, [market]: json }));
        } else if (mainTab === "program") {
          fetchedRef.current.add(key);
          const params = new URLSearchParams({ data_type: "program_day", market });
          const json = await fetchTable(params);
          setProgramData((prev) => ({ ...prev, [market]: json }));
        } else if (mainTab === "deal") {
          fetchedRef.current.add(key);
          const subKeys = ["foreign_buy", "foreign_sell", "inst_buy", "inst_sell"] as const;
          const results: Record<string, SupplyResponse | null> = {};
          await Promise.all(
            subKeys.map(async (subKey) => {
              const params = new URLSearchParams({ data_type: "deal_rank", market, sub_key: subKey });
              results[subKey] = await fetchTable(params);
            }),
          );
          setDealData((prev) => ({ ...prev, [market]: results }));
        }
      } catch (e) {
        console.error("수급 데이터 로드 실패:", e);
        fetchedRef.current.delete(key);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mainTab, market]);

  const currentInvestor = investorData[market];
  const currentProgram = programData[market];
  const currentDeal = dealData[market];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>수급 동향</h1>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)} variant="underline">
        <TabsList style={{ gap: "0.1rem", display: "flex", paddingBottom: "0.1rem" }}>
          <TabsTrigger value="investor">투자자별 매매동향 (일자별)</TabsTrigger>
          <TabsTrigger value="deal">수급 순위</TabsTrigger>
          <TabsTrigger value="program">프로그램 매매 (일자별)</TabsTrigger>
        </TabsList>

        <div className={styles.marketTabs}>
          <Tabs value={market} onValueChange={(v) => setMarket(v as Market)} variant="pill">
            <TabsList>
              <TabsTrigger value="kospi">코스피</TabsTrigger>
              <TabsTrigger value="kosdaq">코스닥</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading && <p className={styles.loading}>불러오는 중...</p>}

        <TabsContent value="investor">
          {!loading && (
            <>
              {currentInvestor ? (
                <>
                  <p className={styles.meta}>
                    기준일: {currentInvestor.bizdate ?? "-"} / 수집: {currentInvestor.collected_time ?? "-"}
                  </p>
                  {currentInvestor.success && currentInvestor.data ? (
                    <InvestorTable data={currentInvestor.data} />
                  ) : (
                    <p className={styles.empty}>데이터가 없습니다.</p>
                  )}
                </>
              ) : (
                <p className={styles.empty}>데이터가 없습니다.</p>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="deal">
          {!loading && (
            <div className={styles.dealGrid}>
              {(["foreign_buy", "foreign_sell", "inst_buy", "inst_sell"] as const).map((key) => {
                const entry = currentDeal[key];
                const titleMap: Record<string, string> = {
                  foreign_buy: "외국인 순매수",
                  foreign_sell: "외국인 순매도",
                  inst_buy: "기관 순매수",
                  inst_sell: "기관 순매도",
                };
                return (
                  <div key={key} className={styles.card}>
                    <div className={styles.cardHeader}>{titleMap[key]}</div>
                    {!entry ? (
                      <p className={styles.emptySmall}>데이터가 없습니다.</p>
                    ) : entry.success && entry.data ? (
                      <>
                        <p className={styles.meta}>
                          기준일: {entry.bizdate ?? "-"} / 수집: {entry.collected_time ?? "-"}
                        </p>
                        <Table data={entry.data} />
                      </>
                    ) : (
                      <p className={styles.emptySmall}>데이터가 없습니다.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="program">
          {!loading && (
            <>
              {currentProgram ? (
                <>
                  <p className={styles.meta}>
                    기준일: {currentProgram.bizdate ?? "-"} / 수집: {currentProgram.collected_time ?? "-"}
                  </p>
                  {currentProgram.success && currentProgram.data ? (
                    <Table data={currentProgram.data} />
                  ) : (
                    <p className={styles.empty}>데이터가 없습니다.</p>
                  )}
                </>
              ) : (
                <p className={styles.empty}>데이터가 없습니다.</p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

