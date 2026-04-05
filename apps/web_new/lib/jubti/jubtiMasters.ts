/** 주BTI 유형 → 결과 화면의 「나와 닮은 투자 대가」 이름 (명언 `name` 필드와 매칭) */
export type JubtiDimension = "A" | "D" | "N" | "I";

export const JUBTI_MASTER_BY_TYPE: Record<JubtiDimension, string> = {
  A: "조지 소로스",
  D: "워런 버핏",
  N: "찰리 멍거",
  I: "피터 린치",
};

export function isJubtiDimension(v: string): v is JubtiDimension {
  return v === "A" || v === "D" || v === "N" || v === "I";
}

/** 명언/인물 이름과 주BTI 대가명이 같은 인물로 볼 수 있는지 (띄어쓰기·포함 관계 허용) */
export function quoteNameMatchesMaster(quoteName: string | undefined, masterName: string): boolean {
  const a = (quoteName ?? "").trim().replace(/\s+/g, " ");
  const b = masterName.trim().replace(/\s+/g, " ");
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

const PRIMARY_WEIGHT = 0.7;

/**
 * 주BTI 대가와 이름이 맞는 명언(또는 인물)을 약 70%, 그 외를 약 30% 비율로 고릅니다.
 * `current`와 같은 항목은 가능하면 제외합니다.
 */
export function pickWeightedByMaster<T extends { name?: string }>(
  items: T[],
  current: T | null,
  matchedMasterName: string | null,
  itemKey: (it: T) => string
): T {
  if (items.length === 0) return current as T;
  if (items.length === 1) return items[0];

  const curKey = current ? itemKey(current) : "";
  const withoutCurrent = (arr: T[]) => arr.filter((x) => itemKey(x) !== curKey);

  if (!matchedMasterName?.trim()) {
    const pool = withoutCurrent(items);
    const use = pool.length > 0 ? pool : items;
    return use[Math.floor(Math.random() * use.length)];
  }

  const primary = items.filter((x) => quoteNameMatchesMaster(x.name, matchedMasterName));
  const other = items.filter((x) => !quoteNameMatchesMaster(x.name, matchedMasterName));

  if (primary.length === 0) {
    const pool = withoutCurrent(items);
    const use = pool.length > 0 ? pool : items;
    return use[Math.floor(Math.random() * use.length)];
  }

  const preferPrimary = Math.random() < PRIMARY_WEIGHT;
  let chosenPool: T[];
  if (preferPrimary) {
    chosenPool = primary.length > 0 ? primary : other.length > 0 ? other : items;
  } else {
    chosenPool = other.length > 0 ? other : primary;
  }

  let candidates = withoutCurrent(chosenPool);
  if (candidates.length === 0) {
    candidates = withoutCurrent(items);
  }
  if (candidates.length === 0) {
    return items[0];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** 중복 없이 `count`명까지 7:3 가중으로 선택 (주톡 대가 카드 초기 노출 등) */
export function pickMultipleWeightedByMaster<T extends { name?: string }>(
  items: T[],
  matchedMasterName: string | null,
  count: number,
  itemKey: (it: T) => string
): T[] {
  if (items.length === 0) return [];
  const picked: T[] = [];
  let remaining = [...items];
  const n = Math.min(count, items.length);
  for (let i = 0; i < n; i++) {
    const prevItem = picked.length > 0 ? picked[picked.length - 1] : null;
    const next = pickWeightedByMaster(remaining, prevItem, matchedMasterName, itemKey);
    picked.push(next);
    const nk = itemKey(next);
    remaining = remaining.filter((x) => itemKey(x) !== nk);
  }
  return picked;
}
