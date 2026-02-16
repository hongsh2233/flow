"use client";

import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import { AllNews } from "./AllNews";
import { FavoriteNews } from "./FavoriteNews";
import styles from "./News.module.css";

interface NewsProps {
  initialTab?: "all" | "favorite";
  isLoggedIn: boolean;
}

export function News({ initialTab = "all", isLoggedIn }: NewsProps) {
  const [activeTab, setActiveTab] = useState<"all" | "favorite">(initialTab);

  return (
    <div className={styles.wrap}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "all" | "favorite")}
      >
        <TabsList className={styles.tabList}>
          <TabsTrigger value="all" className={styles.tab}>
            전체뉴스
          </TabsTrigger>
          <TabsTrigger value="favorite" className={styles.tab}>
            관심뉴스
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
      </Tabs>
    </div>
  );
}
