"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { AllNews } from "../components/module/news/AllNews";
import { ReportTabContent } from "../components/module/briefing/ReportTabContent";
import { SpotlightNews } from "../components/module/briefing/SpotlightNews";
import { StockTermBox } from "../components/module/stock-term-box";
import { AdZoneSlot } from "../components/module/AdZoneSlot";
import { shouldShowAdZoneB_regular } from "@/lib/affiliate/adZoneB";
import styles from "./Briefing.module.css";

function BriefingContent() {
  const { data: session, status } = useSession();

  return (
    <div className={styles.wrap}>
      <StockTermBox wrapperStyle={{ margin: "0 0 1.5rem" }} />
      <Tabs defaultValue="all" variant="underline">
        <TabsList className={styles.tabList}>
          <TabsTrigger value="all" className={styles.tab}>
            뉴스
          </TabsTrigger>
          <TabsTrigger value="spotlight" className={styles.tab}>
            이슈
          </TabsTrigger>
          <TabsTrigger value="report" className={styles.tab}>
            시황/리포트
          </TabsTrigger>
        </TabsList>

        {/* [AD_ZONE B3 — 뉴스 탭과 리스트 사이 / 일반회원까지] */}
        {shouldShowAdZoneB_regular(session, status) && <AdZoneSlot zone="B3" />}

        <TabsContent value="all" className={styles.tabContent}>
          <AllNews />
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
