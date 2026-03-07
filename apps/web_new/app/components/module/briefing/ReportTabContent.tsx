"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import BoardList from "../board/BoardList";
import { fetchBoards } from "@/lib/services/boardService";
import type { Board } from "@/lib/types/board";

export function ReportTabContent() {
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    fetchBoards().then((res) => {
      if (res.success && res.data) {
        const filtered = res.data.filter((b) => {
          if (b.id === "B003") return false; // 주린이 알림 제외
          if (b.type === "guestbook" || b.type === "guest") return false; // 방명록형 제외
          if (b.name?.includes("커뮤니티") || b.name?.includes("방명록")) return false;
          return true;
        });
        setBoards(filtered);
      }
    });
  }, []);

  if (boards.length === 0) {
    return (
      <BoardList emptyMessage="등록된 리포트가 없습니다." />
    );
  }

  if (boards.length === 1) {
    return (
      <BoardList
        boardId={boards[0].id}
        detailHref={(id) => `/report/${id}`}
      />
    );
  }

  return (
    <Tabs defaultValue={boards[0].id}>
      <TabsList style={{ marginBottom: "1rem" }}>
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
  );
}
