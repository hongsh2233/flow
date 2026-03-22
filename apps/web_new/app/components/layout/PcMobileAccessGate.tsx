import { headers } from "next/headers";
import { isJurinAppUserAgent, isMobileUserAgent } from "@/lib/device/platform";
import { resolvePublicSiteUrlFromHeaders } from "@/lib/config/publicSiteUrl";
import PcAccessBlockedScreen from "./PcAccessBlockedScreen";

type Props = {
  children: React.ReactNode;
};

/**
 * PC(데스크톱) 브라우저에서는 안내 화면만 표시.
 * 비활성: NEXT_PUBLIC_PC_ACCESS_GATE=false
 */
export default async function PcMobileAccessGate({ children }: Props) {
  if (process.env.NEXT_PUBLIC_PC_ACCESS_GATE === "false") {
    return children;
  }

  const headerList = await headers();
  const ua = headerList.get("user-agent") ?? "";

  if (isJurinAppUserAgent(ua) || isMobileUserAgent(ua)) {
    return children;
  }

  const siteUrl = resolvePublicSiteUrlFromHeaders(headerList);
  return <PcAccessBlockedScreen siteUrl={siteUrl} />;
}
