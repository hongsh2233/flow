/**
 * 지수 등락 표시용: 화면에 노출되는 등락률(%)과 색·화살표를 맞추기 위해 **percent를 먼저** 본다.
 * Yahoo 등에서 포인트 변동(change)과 등락률 부호가 어긋칠 때(전일종가·틱 차이) 사용자는 %를 기준으로
 * 판단하므로, change를 우선하면 상승 %인데 파란색(하락)으로 나오는 문제가 생긴다.
 */
export function parseIndexChangeStrings(changeStr: string, percentStr: string): {
  isNeutral: boolean;
  isPositive: boolean;
} {
  const stripNum = (s: string) =>
    s
      .replace(/\u2212/g, "-")
      .replace(/\uFF0B/g, "+")
      .replace(/[▲△]/g, "+")
      .replace(/[▼▽]/g, "-")
      .replace(/%/g, "")
      .replace(/,/g, "")
      .trim();
  const pctRaw = stripNum(String(percentStr));
  const chgRaw = stripNum(String(changeStr));
  const pct = parseFloat(pctRaw);
  const chg = parseFloat(chgRaw);

  const chgFinite = Number.isFinite(chg);
  const pctFinite = Number.isFinite(pct);

  if (pctFinite && Math.abs(pct) >= 1e-6) {
    return { isNeutral: false, isPositive: pct > 0 };
  }
  if (chgFinite && Math.abs(chg) >= 1e-6) {
    return { isNeutral: false, isPositive: chg > 0 };
  }
  return { isNeutral: true, isPositive: false };
}
