import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PostWriteForm } from "../../components/module/board/PostWriteForm";

interface WritePageProps {
  searchParams: Promise<{ board?: string }>;
}

export default async function BoardWritePage({ searchParams }: WritePageProps) {
  const { board: boardId } = await searchParams;

  if (!boardId) {
    redirect("/board");
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/board/write?board=${boardId}`)}`
    );
  }

  return (
    <main style={{ paddingBottom: "5rem" }}>
      <PostWriteForm boardId={boardId} />
    </main>
  );
}
