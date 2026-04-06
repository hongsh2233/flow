import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

/** 예전 URL(/stocks/search) → /search 로 이동 */
export default async function LegacyStocksSearchRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  redirect(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
}
