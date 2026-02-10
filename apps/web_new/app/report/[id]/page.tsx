import { notFound } from "next/navigation";
import BoardDetail from "../../components/module/board/BoardDetail";
import { getBoardPostById } from "@/lib/data/board-posts";

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = await params;
  const postId = parseInt(id, 10);

  if (isNaN(postId)) {
    notFound();
  }

  const post = getBoardPostById(postId);

  if (!post) {
    notFound();
  }

  return (
    <main>
      <BoardDetail post={post} backHref="/report" backLabel="목록으로" />
    </main>
  );
}
