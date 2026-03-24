/**
 * 지수 등락 표시용.
 * 화면에 보여지는 등락률(percent)의 부호를 최우선으로 판단하고,
 * 없으면 숫자 파싱으로 보조한다.
 */
export function parseIndexChangeStrings(changeStr: string, percentStr: string): {
  isNeutral: boolean;
  isPositive: boolean;
} {
  const normalize = (s: string) =>
    s
      .replace(/\u2212/g, "-")
      .replace(/\uFF0B/g, "+")
      .replace(/[▲△]/g, "+")
      .replace(/[▼▽]/g, "-");

  const extractSignedNumber = (raw: string): number | null => {
    const s = normalize(String(raw)).replace(/%/g, "").replace(/,/g, "");
    const m = s.match(/[+-]?\s*\d+(?:\.\d+)?/);
    if (!m) return null;
    const v = parseFloat(m[0].replace(/\s+/g, ""));
    return Number.isFinite(v) ? v : null;
  };

  const pctRaw = normalize(String(percentStr));
  if (/\+\s*\d/.test(pctRaw)) return { isNeutral: false, isPositive: true };
  if (/-\s*\d/.test(pctRaw)) return { isNeutral: false, isPositive: false };

  const pct = extractSignedNumber(percentStr);
  if (pct != null && Math.abs(pct) >= 1e-6) {
    return { isNeutral: false, isPositive: pct > 0 };
  }

  const chg = extractSignedNumber(changeStr);
  if (chg != null && Math.abs(chg) >= 1e-6) {
    return { isNeutral: false, isPositive: chg > 0 };
  }

  return { isNeutral: true, isPositive: false };
}
