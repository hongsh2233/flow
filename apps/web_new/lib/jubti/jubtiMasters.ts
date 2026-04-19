/** 주BTI 유형 → 결과 화면의 「나와 닮은 투자 대가」 이름 (명언 `name` 필드와 매칭) */
export type JubtiDimension = "A" | "D" | "N" | "I";

/** MBTI 16유형 → 투자성향(A/D/N/I) 매핑 */
export const MBTI_TO_JUBTI: Record<string, JubtiDimension> = {
  INTJ: "N", INTP: "N", ENTJ: "N", ENTP: "N",
  ISTJ: "D", ISFJ: "D", ESTJ: "D", ESFJ: "D",
  ISTP: "A", ESTP: "A", ENFJ: "A", ENFP: "A",
  INFJ: "I", INFP: "I", ESFP: "I", ISFP: "I",
};

/** MBTI 유형별 투자 성향 설명 (AI 프롬프트 컨텍스트용) */
export const MBTI_INVEST_DESCRIPTION: Record<string, string> = {
  INTJ: "장기 비전과 체계적 분석, 독립적 판단력으로 시장을 꿰뚫는 전략가형",
  INTP: "논리적 분석과 패턴 탐구, 비효율을 찾아내는 이론가형",
  ENTJ: "대담한 결단력과 리더십으로 큰 그림을 그리는 지휘관형",
  ENTP: "창의적 아이디어와 트렌드 포착, 역발상 투자를 즐기는 논쟁가형",
  ISTJ: "데이터와 원칙에 충실, 신중하고 꾸준한 장기 안정 투자형",
  ISFJ: "리스크 회피 성향, 안전 자산 선호, 착실한 분산 투자형",
  ESTJ: "규칙과 계획 중시, 검증된 방법론으로 체계적 관리형",
  ESFJ: "주변 정보와 커뮤니티 분위기를 반영, 관계 기반 투자형",
  ISTP: "실용적 분석과 빠른 상황 판단, 단기 기회 포착형",
  ESTP: "즉각적 실행력과 위험 감수, 고수익 단기 트레이딩형",
  ENFJ: "큰 흐름과 사회 변화 읽기, 테마·섹터 중심 투자형",
  ENFP: "직관과 열정으로 새로운 트렌드를 빠르게 포착하는 활동가형",
  INFJ: "깊은 통찰과 장기 비전, 신념 기반 가치투자형",
  INFP: "가치와 신념 중심, 철학적 투자 원칙을 고수하는 중재자형",
  ESFP: "활발하고 감각적, 핫이슈와 시장 분위기에 민감한 즉흥투자형",
  ISFP: "섬세한 감각과 유연성, 직관적 타이밍 포착형",
};

export const VALID_MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ESTP", "ENFJ", "ENFP",
  "INFJ", "INFP", "ESFP", "ISFP",
] as const;

export type MbtiType = typeof VALID_MBTI_TYPES[number];

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
