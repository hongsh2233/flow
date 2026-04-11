/**
 * 네이버 수급 API 등에서 쓰는 합산 단위: 백만 원.
 * 100백만원 = 1억원, 1,000,000백만원 = 1조원
 */
function isWhole(x: number): boolean {
  return Math.abs(x - Math.round(x)) < 1e-6;
}

/** 절댓값(백만 원) → 조원 / 억원 / 백만원 문자열 (부호 없음) */
export function formatSupplyAmountAbsMillion(absMillionWon: number): string {
  const abs = Math.round(Math.abs(absMillionWon));
  if (abs === 0) return "0원";

  if (abs >= 1_000_000) {
    const jo = abs / 1_000_000;
    const text =
      jo >= 10 || isWhole(jo)
        ? Math.round(jo).toLocaleString("ko-KR")
        : (Math.round(jo * 10) / 10).toLocaleString("ko-KR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });
    return `${text}조원`;
  }

  if (abs >= 100) {
    const eok = abs / 100;
    const text =
      isWhole(eok) || Math.abs(eok) >= 1000
        ? Math.round(eok).toLocaleString("ko-KR")
        : (Math.round(eok * 10) / 10).toLocaleString("ko-KR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
          });
    return `${text}억원`;
  }

  return `${abs.toLocaleString("ko-KR")}백만원`;
}

/** 백만 원 기준 순매수금액 → +1,234억원 / -50백만원 */
export function formatSupplySignedMillion(millionWon: number): string {
  if (millionWon === 0) return "0원";
  const core = formatSupplyAmountAbsMillion(millionWon);
  return millionWon > 0 ? `+${core}` : `-${core}`;
}
