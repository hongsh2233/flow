/** 생년월일 → 별자리 자동계산 + 띠 관련 유틸 */

export const ZODIAC_ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;
export type ZodiacAnimal = typeof ZODIAC_ANIMALS[number];

export const ZODIAC_ANIMAL_EMOJI: Record<ZodiacAnimal, string> = {
  쥐: "🐭", 소: "🐮", 호랑이: "🐯", 토끼: "🐰",
  용: "🐲", 뱀: "🐍", 말: "🐴", 양: "🐑",
  원숭이: "🐵", 닭: "🐔", 개: "🐶", 돼지: "🐷",
};

export const ZODIAC_SIGNS = [
  "양자리", "황소자리", "쌍둥이자리", "게자리", "사자자리", "처녀자리",
  "천칭자리", "전갈자리", "사수자리", "염소자리", "물병자리", "물고기자리",
] as const;
export type ZodiacSign = typeof ZODIAC_SIGNS[number];

export const ZODIAC_SIGN_EMOJI: Record<ZodiacSign, string> = {
  양자리: "♈", 황소자리: "♉", 쌍둥이자리: "♊", 게자리: "♋",
  사자자리: "♌", 처녀자리: "♍", 천칭자리: "♎", 전갈자리: "♏",
  사수자리: "♐", 염소자리: "♑", 물병자리: "♒", 물고기자리: "♓",
};

interface SignRange {
  sign: ZodiacSign;
  start: [number, number]; // [month, day]
  end: [number, number];
}

const SIGN_RANGES: SignRange[] = [
  { sign: "양자리",     start: [3, 21], end: [4, 19] },
  { sign: "황소자리",   start: [4, 20], end: [5, 20] },
  { sign: "쌍둥이자리", start: [5, 21], end: [6, 20] },
  { sign: "게자리",     start: [6, 21], end: [7, 22] },
  { sign: "사자자리",   start: [7, 23], end: [8, 22] },
  { sign: "처녀자리",   start: [8, 23], end: [9, 22] },
  { sign: "천칭자리",   start: [9, 23], end: [10, 22] },
  { sign: "전갈자리",   start: [10, 23], end: [11, 21] },
  { sign: "사수자리",   start: [11, 22], end: [12, 21] },
  { sign: "염소자리",   start: [12, 22], end: [1, 19] },
  { sign: "물병자리",   start: [1, 20], end: [2, 18] },
  { sign: "물고기자리", start: [2, 19], end: [3, 20] },
];

/** 월(1~12), 일(1~31) → 별자리 반환. 범위 밖이면 null */
export function getZodiacSignFromDate(month: number, day: number): ZodiacSign | null {
  for (const { sign, start, end } of SIGN_RANGES) {
    const [sm, sd] = start;
    const [em, ed] = end;
    if (sm <= em) {
      // 같은 달 또는 연속 달 (12월 이외)
      if ((month === sm && day >= sd) || (month === em && day <= ed) || (month > sm && month < em)) {
        return sign;
      }
    } else {
      // 연말→연초 걸치는 경우 (염소자리: 12/22~1/19)
      if ((month === sm && day >= sd) || (month === em && day <= ed)) {
        return sign;
      }
    }
  }
  return null;
}

/** 출생연도 → 띠 반환 */
export function getZodiacAnimalFromYear(year: number): ZodiacAnimal {
  const idx = ((year - 4) % 12 + 12) % 12;
  return ZODIAC_ANIMALS[idx];
}
