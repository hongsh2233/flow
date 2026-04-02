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

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getPost(postId: string, accessToken?: string | null): Promise<PostFromApi | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      method: "GET",
      headers: getAuthHeaders(accessToken ?? undefined),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data ?? null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function truncateContentTo100(html: string): string {
  const plain = stripHtml(html);
  return plain.length > 100 ? plain.slice(0, 100) + "…" : plain;
}

function canAccessByGrade(memberGrade: string | undefined, requiredGrade: string): boolean {
  if (requiredGrade === "all") return true;
  const hierarchy = ["regular", "vip", "family"];
  const userLevel = hierarchy.indexOf(memberGrade || "regular");
  const requiredLevel = hierarchy.indexOf(requiredGrade);
  return userLevel >= requiredLevel && userLevel >= 0;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = await params;
  const postId = parseInt(id, 10);

  if (isNaN(postId)) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const accessToken =
    (session as { backendAccessToken?: string | null } | null)?.backendAccessToken ?? null;
  const apiPost = await getPost(id, accessToken);

  if (!apiPost) {
    return notFound();
  }
  const isMemberOnly = apiPost.is_member_only === "true";
  const memberOnlyGrade = apiPost.member_only_grade || "all";
  const publicVisibility = apiPost.public_visibility || "full";
  const userGrade = (session?.user as { grade?: string })?.grade;

  if (isMemberOnly && !session) {
    return (
      <>
        <main style={{ padding: "1rem", paddingBottom: "5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <Link href="/report" style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none" }}>
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
              href={`/login?callbackUrl=${encodeURIComponent(`/report/${id}`)}`}
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

  if (isMemberOnly && session && !canAccessByGrade(userGrade, memberOnlyGrade)) {
    const gradeLabel = memberOnlyGrade === "family" ? "FAMILY" : "VIP 이상";
    return (
      <>
        <main style={{ padding: "1rem", paddingBottom: "5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <Link href="/report" style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none" }}>
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
              {gradeLabel} 전용 콘텐츠
            </h2>
            <p style={{ fontSize: "0.9375rem", color: "var(--app-text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              이 게시글은 {gradeLabel} 등급 회원만 열람할 수 있습니다.
            </p>
            <Link
              href="/membership"
              style={{
                display: "inline-block", padding: "0.75rem 2rem", borderRadius: "0.75rem",
                background: "var(--app-primary, #f97316)", color: "#fff", fontWeight: 600,
                fontSize: "0.9375rem", textDecoration: "none",
              }}
            >
              멤버십 구독하기
            </Link>
          </div>
        </main>
        <StockTermBox wrapperStyle={{ padding: "1rem", marginTop: "1.5rem" }} />
      </>
    );
  }

  // 전체공개 + 일부노출 + 비로그인: 100자 미리보기 + 회원가입 유도
  const isPartialForSignup = !isMemberOnly && publicVisibility === "partial" && !session;
  if (isPartialForSignup) {
    apiPost.content = truncateContentTo100(apiPost.content);
    apiPost._partial = true;
    apiPost._block_reason = "signup_needed";
  }

  const post = postToDetail(apiPost);

  return (
    <>
      <main>
        <BoardDetail post={post} backHref="/report" backLabel="목록으로" />
      </main>
      <StockTermBox wrapperStyle={{ padding: "1rem", marginTop: "1.5rem" }} />
    </>
  );
}
