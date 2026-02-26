"use client";

import { useEffect, useState } from "react";
import styles from "./Report.module.css";
import BoardList from "../components/module/board/BoardList";
import { StockTermBox } from "../components/module/stock-term-box";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { fetchBoards } from "@/lib/services/boardService";
import type { Board } from "@/lib/types/board";

export default function ReportPage() {
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    fetchBoards().then((res) => {
      if (res.success && res.data) {
        // 시황 탭에서는 주린이 알림(B003) 게시판 제외
        const filtered = res.data.filter((b) => b.id !== "B003");
        setBoards(filtered);
      }
    });
  }, []);

  const termBox = (
    <StockTermBox wrapperStyle={{ margin: "0 0 1.5rem" }} />
  );

  // 게시판이 없으면 빈 상태 표시
  if (boards.length === 0) {
    return (
      <>
        {termBox}
        <main className={styles.wrap}>
          <BoardList emptyMessage="등록된 게시판이 없습니다." />
        </main>
        
      </>
    );
  }

  // 게시판이 1개면 탭 없이 바로 표시
  if (boards.length === 1) {
    return (
      <>
        <main className={styles.wrap}>
          <BoardList
            boardId={boards[0].id}
            detailHref={(id) => `/report/${id}`}
          />
        </main>
        {termBox}
      </>
    );
  }

  // 게시판이 여러 개면 탭으로 표시
  return (
    <>
      <main className={styles.wrap}>
        {termBox}
        <Tabs defaultValue={boards[0].id}>
        <TabsList>
          {boards.map((board) => (
            <TabsTrigger key={board.id} value={board.id}>
              {board.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {boards.map((board) => (
          <TabsContent key={board.id} value={board.id}>
            <BoardList
              boardId={board.id}
              detailHref={(id) => `/report/${id}`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </main>    
    </>
  );
}
