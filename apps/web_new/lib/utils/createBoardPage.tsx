/**
 * 게시판 페이지 팩토리 유틸리티
 *
 * 새 게시판 페이지를 쉽게 추가할 수 있도록 도와주는 유틸리티입니다.
 *
 * ── 사용법 ──
 *
 * 1. 리스트 페이지 생성 (예: app/notice/page.tsx)
 *
 *    import { createBoardListPage } from "@/lib/utils/createBoardPage";
 *    export default createBoardListPage({
 *      boardId: "B002",           // BO에서 생성한 게시판 코드
 *      title: "공지사항",           // 페이지 제목 (선택)
 *      detailPath: "/notice",     // 상세 페이지 경로
 *    });
 *
 * 2. 상세 페이지 생성 (예: app/notice/[id]/page.tsx)
 *
 *    import { createBoardDetailPage } from "@/lib/utils/createBoardPage";
 *    export default createBoardDetailPage({
 *      backHref: "/notice",       // 목록으로 돌아가는 경로
 *      backLabel: "공지사항 목록",  // 돌아가기 버튼 텍스트 (선택)
 *    });
 *
 * 3. 여러 게시판을 탭으로 묶기 (예: app/community/page.tsx)
 *
 *    import { createMultiBoardPage } from "@/lib/utils/createBoardPage";
 *    export default createMultiBoardPage({
 *      boards: [
 *        { boardId: "B003", label: "자유게시판" },
 *        { boardId: "B004", label: "질문답변" },
 *      ],
 *      detailPath: "/community",
 *    });
 */

import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import BoardList from "@/app/components/module/board/BoardList";
import BoardDetail from "@/app/components/module/board/BoardDetail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";
import { postToDetail } from "@/lib/services/boardService";
import type { PostFromApi } from "@/lib/types/board";

// ── 리스트 페이지 팩토리 ──

interface BoardListPageConfig {
  boardId: string;
  title?: string;
  detailPath?: string;
  emptyMessage?: string;
}

export function createBoardListPage(config: BoardListPageConfig) {
  const {
    boardId,
    title,
    detailPath = "/board",
    emptyMessage,
  } = config;

  return function BoardListPage() {
    return (
      <main style={{ padding: "1rem 1rem 5rem", minHeight: "100vh" }}>
        {title && (
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {title}
          </h2>
        )}
        <BoardList
          boardId={boardId}
          detailHref={(id) => `${detailPath}/${id}`}
          emptyMessage={emptyMessage}
        />
      </main>
    );
  };
}

// ── 상세 페이지 팩토리 ──

interface BoardDetailPageConfig {
  backHref?: string;
  backLabel?: string;
}

export function createBoardDetailPage(config: BoardDetailPageConfig = {}) {
  const { backHref = "/board", backLabel = "목록으로" } = config;

  return async function BoardDetailPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    const accessToken =
      (session as { backendAccessToken?: string | null } | null)?.backendAccessToken ?? null;

    let apiPost: PostFromApi | null = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${id}`, {
        method: "GET",
        headers: getAuthHeaders(accessToken ?? undefined),
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        apiPost = data.data ?? null;
      }
    } catch {
      // fetch 실패 시 null
    }

    if (!apiPost) {
      return notFound();
    }

    const post = postToDetail(apiPost);

    return (
      <main>
        <BoardDetail post={post} backHref={backHref} backLabel={backLabel} />
      </main>
    );
  };
}

// ── 멀티 게시판 탭 페이지 팩토리 ──

interface MultiBoardConfig {
  boards: Array<{ boardId: string; label: string }>;
  detailPath?: string;
}

export function createMultiBoardPage(config: MultiBoardConfig) {
  const { boards, detailPath = "/board" } = config;

  return function MultiBoardPage() {
    if (boards.length === 0) {
      return (
        <main style={{ padding: "1rem 1rem 5rem", minHeight: "100vh" }}>
          <BoardList emptyMessage="등록된 게시판이 없습니다." />
        </main>
      );
    }

    if (boards.length === 1) {
      return (
        <main style={{ padding: "1rem 1rem 5rem", minHeight: "100vh" }}>
          <BoardList
            boardId={boards[0].boardId}
            detailHref={(id) => `${detailPath}/${id}`}
          />
        </main>
      );
    }

    return (
      <main style={{ padding: "1rem 1rem 5rem", minHeight: "100vh" }}>
        <Tabs defaultValue={boards[0].boardId}>
          <TabsList>
            {boards.map((b) => (
              <TabsTrigger key={b.boardId} value={b.boardId}>
                {b.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {boards.map((b) => (
            <TabsContent key={b.boardId} value={b.boardId}>
              <BoardList
                boardId={b.boardId}
                detailHref={(id) => `${detailPath}/${id}`}
              />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    );
  };
}
