"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PostWriteForm } from "../../components/module/board/PostWriteForm";

function WritePageContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board") || "";
  const { status } = useSession();
  const router = useRouter();

  // 미인증 시 로그인 페이지로 이동
  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = encodeURIComponent(`/board/write?board=${boardId}`);
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [status, boardId, router]);

  if (status === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)" }}>
        로딩 중...
      </div>
    );
  }

  if (!boardId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)" }}>
        게시판 정보가 없습니다. 게시판 목록에서 다시 시도해 주세요.
      </div>
    );
  }

  if (status !== "authenticated") return null;

  return <PostWriteForm boardId={boardId} />;
}

export default function BoardWritePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--app-text-muted)" }}>
        로딩 중...
      </div>
    }>
      <WritePageContent />
    </Suspense>
  );
}
