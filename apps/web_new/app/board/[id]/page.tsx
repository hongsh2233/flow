import { notFound } from "next/navigation";
import BoardDetail from "../../components/module/board/BoardDetail";
import { StockTermBox } from "../../components/module/stock-term-box";
import { API_BASE_URL, getAuthHeaders } from "@/lib/config/api";
import { postToDetail } from "@/lib/services/boardService";
import type { PostFromApi } from "@/lib/types/board";

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

  const post = postToDetail(apiPost);
  const backHref = from ? `/board?board=${from}` : "/board";

  return (
    <>
      <main>
        <BoardDetail
          post={post}
          backHref={backHref}
          backLabel="목록으로"
        />
      </main>
      <div style={{ padding: "1rem", marginTop: "1.5rem" }}>
        <StockTermBox />
      </div>
    </>
  );
}
