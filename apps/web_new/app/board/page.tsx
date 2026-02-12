"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "./Board.module.css";
import BoardList from "../components/module/board/BoardList";
import type { Board } from "@/lib/types/board";

function BoardPageContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board") || "";
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    if (!boardId) return;
    fetch(`/api/boards`)
      .then((res) => res.json())
      .then((data) => {
        const found = (data.data || []).find((b: Board) => b.id === boardId);
        if (found) setBoard(found);
      })
      .catch(console.error);
  }, [boardId]);

  if (!boardId) {
    return (
      <main className={styles.wrap}>
        <BoardList emptyMessage="게시판을 선택해주세요." />
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      {board && <h2 className={styles.pageTitle}>{board.name}</h2>}
      <BoardList
        boardId={boardId}
        detailHref={(id) => `/board/${id}?from=${boardId}`}
      />
    </main>
  );
}

export default function BoardPage() {
  return (
    <Suspense>
      <BoardPageContent />
    </Suspense>
  );
}
