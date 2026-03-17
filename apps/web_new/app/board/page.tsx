"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "next-auth/react";
import styles from "./Board.module.css";
import BoardList from "../components/module/board/BoardList";
import { StockTermBox } from "../components/module/stock-term-box";
import type { Board } from "@/lib/types/board";

function BoardPageContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board") || "";
  const [board, setBoard] = useState<Board | null>(null);
  const { status } = useSession();
  const router = useRouter();

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
      <>
        <main className={styles.wrap}>
          <BoardList emptyMessage="게시판을 선택해주세요." />
        </main>
        <StockTermBox wrapperStyle={{ padding: "0 1rem 1.5rem", marginTop: "1.5rem" }} />
      </>
    );
  }

  return (
    <>
      <main className={styles.wrap}>
        <div className={styles.boardHeader}>
          {board ? (
            <h2 className={styles.pageTitle}>{board.name}</h2>
          ) : (
            <div />
          )}
          {status === "authenticated" && (
            <button
              type="button"
              className={styles.writeBtn}
              onClick={() => router.push(`/board/write?board=${boardId}`)}
            >
              ✏ 글쓰기
            </button>
          )}
        </div>
        <BoardList
          boardId={boardId}
          detailHref={(id) => `/board/${id}?from=${boardId}`}
        />
      </main>
      <StockTermBox wrapperStyle={{ padding: "0 1rem 1.5rem", marginTop: "1.5rem" }} />
    </>
  );
}

export default function BoardPage() {
  return (
    <Suspense>
      <BoardPageContent />
    </Suspense>
  );
}
