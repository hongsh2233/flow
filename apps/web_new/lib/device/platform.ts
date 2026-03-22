/**
 * PC / 모바일 브라우저 구분 (User-Agent 기준).
 * 서버: headers().get("user-agent") 를 넘기면 됨.
 * 클라이언트: navigator.userAgent 또는 인자 생략 시 자동.
 */

const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk/i;

/**
 * @param userAgent - 생략 시 브라우저에서만 navigator.userAgent 사용 (SSR에서는 false)
 */
export function isMobileUserAgent(userAgent?: string | null): boolean {
  const ua =
    userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "") ??
    "";
  return MOBILE_UA_PATTERN.test(ua);
}

/** PC 브라우저로 간주할 때 true (태블릿·폰 UA는 mo) */
export function isPcUserAgent(userAgent?: string | null): boolean {
  return !isMobileUserAgent(userAgent);
}

export type AccessUaKind = "pc" | "mo";

export function accessKindFromUserAgent(userAgent: string | null | undefined): AccessUaKind {
  return isMobileUserAgent(userAgent ?? "") ? "mo" : "pc";
}

/** JurinApp Android WebView UA (MainActivity에서 JurinApp 문자열 포함) */
export function isJurinAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /JurinApp/i.test(userAgent);
}
