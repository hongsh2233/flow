/**
 * 지수 등락 표시용: 포인트 변동(change)을 우선하고, 0에 가깝거나 비파싱이면 등락률(percent) 사용.
 * change·percent 문자열 부호가 어긋난 경우에도 화살표·색이 변동폭과 일치하도록 한다.
 */
export function parseIndexChangeStrings(changeStr: string, percentStr: string): {
  isNeutral: boolean;
  isPositive: boolean;
} {
  const stripNum = (s: string) =>
    s.replace(/\u2212/g, "-").replace(/%/g, "").replace(/,/g, "").trim();
  const pctRaw = stripNum(String(percentStr));
  const chgRaw = stripNum(String(changeStr));
  const pct = parseFloat(pctRaw);
  const chg = parseFloat(chgRaw);

  const chgFinite = Number.isFinite(chg);
  const pctFinite = Number.isFinite(pct);

  if (chgFinite && Math.abs(chg) >= 1e-6) {
    return { isNeutral: false, isPositive: chg > 0 };
  }
  if (pctFinite && Math.abs(pct) >= 1e-6) {
    return { isNeutral: false, isPositive: pct > 0 };
  }
  return { isNeutral: true, isPositive: false };
}
