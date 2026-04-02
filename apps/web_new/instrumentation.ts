/**
 * Node 런타임에서 전역 fetch(undici) 타임아웃을 넉넉히 둡니다.
 * BO(Admin API) 프록시가 한꺼번에 실패하며 UND_ERR_HEADERS_TIMEOUT 이 나는 경우,
 * 상대 서버가 느리거나 콜드 스타트일 때 기본 한도보다 오래 기다리도록 합니다.
 *
 * Edge 런타임에서는 undici를 쓰지 않으므로 건너뜁니다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const connectMs = parseInt(process.env.BO_FETCH_CONNECT_TIMEOUT_MS || "120000", 10);
  const headersMs = parseInt(process.env.BO_FETCH_HEADERS_TIMEOUT_MS || "180000", 10);
  const bodyMs = parseInt(process.env.BO_FETCH_BODY_TIMEOUT_MS || "300000", 10);

  try {
    const { setGlobalDispatcher, Agent } = await import("undici");
    setGlobalDispatcher(
      new Agent({
        connectTimeout: connectMs,
        headersTimeout: headersMs,
        bodyTimeout: bodyMs,
      })
    );
  } catch {
    // 빌드/번들 환경에서 undici 로드 실패 시 기본 fetch 유지
  }
}
