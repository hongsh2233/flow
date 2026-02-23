import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import BoardDetail from "../../components/module/board/BoardDetail";
import { StockTermBox } from "../../components/module/stock-term-box";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";
import { postToDetail } from "@/lib/services/boardService";
import type { PostFromApi } from "@/lib/types/board";
import Lock from "@mui/icons-material/Lock";

interface BoardDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

async function getPost(postId: string): Promise<PostFromApi | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data ?? null;
  } catch {
    return null;
  }
}

export default async function BoardDetailPage({ params, searchParams }: BoardDetailPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const postId = parseInt(id, 10);

  if (isNaN(postId)) {
    notFound();
  }

  const apiPost = await getPost(id);

  if (!apiPost) {
    return notFound();
  }

  const session = await getServerSession(authOptions);
  const backHref = from ? `/board?board=${from}` : "/board";
  const isMemberOnly = apiPost.is_member_only === "true";

  if (isMemberOnly && !session) {
    return (
      <>
        <main style={{ padding: "1rem", paddingBottom: "5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <Link href={backHref} style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none" }}>
              ← 목록으로
            </Link>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "var(--app-card-bg)", borderRadius: "1rem", padding: "3rem 1.5rem",
            boxShadow: "var(--app-card-shadow)", border: "1px solid var(--app-border-light)", textAlign: "center",
          }}>
            <Lock style={{ fontSize: "3rem", color: "var(--app-text-placeholder)", marginBottom: "1rem" }} />
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--app-text)", marginBottom: "0.5rem" }}>
              회원 전용 콘텐츠
            </h2>
            <p style={{ fontSize: "0.9375rem", color: "var(--app-text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              이 게시글은 로그인한 회원만 열람할 수 있습니다.
            </p>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/board/${id}${from ? `?from=${from}` : ""}`)}`}
              style={{
                display: "inline-block", padding: "0.75rem 2rem", borderRadius: "0.75rem",
                background: "var(--app-primary, #f97316)", color: "#fff", fontWeight: 600,
                fontSize: "0.9375rem", textDecoration: "none",
              }}
            >
              로그인하기
            </Link>
          </div>
        </main>
        <StockTermBox wrapperStyle={{ padding: "1rem", marginTop: "1.5rem" }} />
      </>
    );
  }

  const post = postToDetail(apiPost);

  return (
    <>
      <main>
        <BoardDetail
          post={post}
          backHref={backHref}
          backLabel="목록으로"
        />
      </main>
      <StockTermBox wrapperStyle={{ padding: "1rem", marginTop: "1.5rem" }} />
    </>
  );
}
