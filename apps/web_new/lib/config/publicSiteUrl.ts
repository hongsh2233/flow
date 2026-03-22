/**
 * QR·공유용 공개 사이트 URL (요청 Host / 환경 변수).
 */
export function resolvePublicSiteUrlFromHeaders(headerList: Headers): string {
  const rawHost = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const host = rawHost.split(",")[0]?.trim() ?? "";
  const rawProto = headerList.get("x-forwarded-proto") ?? "https";
  const proto = rawProto.split(",")[0]?.trim() || "https";

  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  return "";
}
