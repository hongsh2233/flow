\"use client\";

import { useEffect, useState } from \"react\";
import styles from \"./SupplyPage.module.css\";

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

type Market = \"kospi\" | \"kosdaq\";

type MainTab = \"investor\" | \"deal\" | \"program\";

async function fetchTable(params: URLSearchParams): Promise<SupplyResponse> {
  const res = await fetch(`/api/naver-supply?${params.toString()}`, { cache: \"no-store\" });
  if (!res.ok) {
    return { success: false, data: null, bizdate: null };
  }
  return res.json();
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
                const isMinus = i > 0 && String(cell).trim().startsWith(\"-\");
                const isPlus = i > 0 && String(cell).trim().startsWith(\"+\");
                const cls =
                  isMinus ? styles.down : isPlus ? styles.up : undefined;
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
  const [mainTab, setMainTab] = useState<MainTab>(\"investor\");
  const [market, setMarket] = useState<Market>(\"kospi\");

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (mainTab === \"investor\") {
          if (!investorData[market]) {
            const params = new URLSearchParams({
              data_type: \"investor_day\",
              market,
            });
            const json = await fetchTable(params);
            setInvestorData((prev) => ({ ...prev, [market]: json }));
          }
        } else if (mainTab === \"program\") {
          if (!programData[market]) {
            const params = new URLSearchParams({
              data_type: \"program_day\",
              market,
            });
            const json = await fetchTable(params);
            setProgramData((prev) => ({ ...prev, [market]: json }));
          }
        } else if (mainTab == \"deal\") {
          const current = dealData[market];
          if (!current.foreign_buy || !current.foreign_sell || !current.inst_buy || !current.inst_sell) {
            const keys = [\"foreign_buy\", \"foreign_sell\", \"inst_buy\", \"inst_sell\"] as const;
            const results: Record<string, SupplyResponse | null> = { ...current };
            await Promise.all(
              keys.map(async (key) => {
                if (results[key]) return;
                const params = new URLSearchParams({
                  data_type: \"deal_rank\",
                  market,
                  sub_key: key,
                });
                const json = await fetchTable(params);
                results[key] = json;
              })
            );
            setDealData((prev) => ({ ...prev, [market]: results }));
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mainTab, market, investorData, programData, dealData]);

  const currentInvestor = investorData[market];
  const currentProgram = programData[market];
  const currentDeal = dealData[market];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>수급 동향</h1>

      <div className={styles.mainTabs}>
        <button
          type=\"button\"
          className={mainTab === \"investor\" ? styles.mainTabActive : styles.mainTab}
          onClick={() => setMainTab(\"investor\")}
        >
          투자자별 매매동향 (일자별)
        </button>
        <button
          type=\"button\"
          className={mainTab === \"deal\" ? styles.mainTabActive : styles.mainTab}
          onClick={() => setMainTab(\"deal\")}
        >
          수급 순위
        </button>
        <button
          type=\"button\"
          className={mainTab === \"program\" ? styles.mainTabActive : styles.mainTab}
          onClick={() => setMainTab(\"program\")}
        >
          프로그램 매매 (일자별)
        </button>
      </div>

      <div className={styles.subTabs}>
        <button
          type=\"button\"
          className={market === \"kospi\" ? styles.subTabActive : styles.subTab}
          onClick={() => setMarket(\"kospi\")}
        >
          코스피
        </button>
        <button
          type=\"button\"
          className={market === \"kosdaq\" ? styles.subTabActive : styles.subTab}
          onClick={() => setMarket(\"kosdaq\")}
        >
          코스닥
        </button>
      </div>

      {loading && <p className={styles.loading}>불러오는 중...</p>}

      {!loading && mainTab === \"investor\" && currentInvestor && (
        <>
          <p className={styles.meta}>
            기준일: {currentInvestor.bizdate ?? \"-\"} / 수집: {currentInvestor.collected_time ?? \"-\"}
          </p>
          {currentInvestor.success && currentInvestor.data ? (
            <Table data={currentInvestor.data} />
          ) : (
            <p className={styles.empty}>데이터가 없습니다.</p>
          )}
        </>
      )}

      {!loading && mainTab === \"program\" && currentProgram && (
        <>
          <p className={styles.meta}>
            기준일: {currentProgram.bizdate ?? \"-\"} / 수집: {currentProgram.collected_time ?? \"-\"}
          </p>
          {currentProgram.success && currentProgram.data ? (
            <Table data={currentProgram.data} />
          ) : (
            <p className={styles.empty}>데이터가 없습니다.</p>
          )}
        </>
      )}

      {!loading && mainTab === \"deal\" && (
        <div className={styles.dealGrid}>
          {([\"foreign_buy\", \"foreign_sell\", \"inst_buy\", \"inst_sell\"] as const).map((key) => {
            const entry = currentDeal[key];
            const titleMap: Record<string, string> = {
              foreign_buy: \"외국인 순매수\",
              foreign_sell: \"외국인 순매도\",
              inst_buy: \"기관 순매수\",
              inst_sell: \"기관 순매도\",
            };
            return (
              <div key={key} className={styles.card}>
                <div className={styles.cardHeader}>{titleMap[key]}</div>
                {!entry ? (
                  <p className={styles.emptySmall}>데이터가 없습니다.</p>
                ) : entry.success && entry.data ? (
                  <>
                    <p className={styles.meta}>
                      기준일: {entry.bizdate ?? \"-\"} / 수집: {entry.collected_time ?? \"-\"}
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
    </div>
  );
}

