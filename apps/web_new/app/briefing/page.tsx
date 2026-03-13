"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { AllNews } from "../components/module/news/AllNews";
import { FavoriteNews } from "../components/module/news/FavoriteNews";
import { MarketIndicesTab } from "../components/module/briefing/MarketIndicesTab";
import { ReportTabContent } from "../components/module/briefing/ReportTabContent";
import { SpotlightNews } from "../components/module/briefing/SpotlightNews";
import { StockTermBox } from "../components/module/stock-term-box";
import styles from "./Briefing.module.css";

function BriefingContent() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <div className={styles.wrap}>
      <StockTermBox wrapperStyle={{ margin: "0 0 1.5rem" }} />
      <Tabs defaultValue="all" variant="underline">
        <TabsList className={styles.tabList}>
          <TabsTrigger value="all" className={styles.tab}>
            전체뉴스
          </TabsTrigger>
          <TabsTrigger value="favorite" className={styles.tab}>
            관심뉴스
          </TabsTrigger>
          <TabsTrigger value="spotlight" className={styles.tab}>
            이슈
          </TabsTrigger>
          <TabsTrigger value="report" className={styles.tab}>
            시황/리포트
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className={styles.tabContent}>
          <AllNews />
        </TabsContent>

        <TabsContent value="favorite" className={styles.tabContent}>
          {isLoggedIn ? (
            <FavoriteNews />
          ) : (
            <div className={styles.loginPrompt}>
              <p>로그인 후 관심종목으로 등록한 종목의 뉴스를 확인할 수 있습니다.</p>
              <a href="/login" className={styles.loginLink}>
                로그인하기
              </a>
            </div>
          )}
        </TabsContent>

        <TabsContent value="spotlight" className={styles.tabContent}>
          <SpotlightNews />
        </TabsContent>

        <TabsContent value="report" className={styles.tabContent}>
          <ReportTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function BriefingPage() {
  return (
    <div className="content__wrap">
      <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>로딩 중...</div>}>
        <BriefingContent />
      </Suspense>
    </div>
  );
}
