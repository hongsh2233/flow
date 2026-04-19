# MBTI 투자성향 + 오늘의 운세 기능 설계

## 개요

기존 "주BTI"(자체 4유형 A/D/N/I 투자성향 테스트)를 MBTI 기반 투자성향 분석으로 확장하고,  
오늘의 띠별·별자리 운세와 결합한 AI 투자조언 시스템을 구축한다.

**목적**: 재미·참여도 향상 + 개인화된 투자조언으로 사용자 체류 시간 및 회원가입 유도

---

## 구현 범위 (6 Features)

| # | 기능 | 핵심 변경 |
|---|------|-----------|
| F1 | 주BTI → "MBTI로 보는 투자성향" 리브랜딩 | UI 텍스트 변경 |
| F2 | 내 MBTI 16유형 입력/저장 | DB 컬럼 + API + UI 선택기 |
| F3 | 투자성향(A/D/N/I) + MBTI → Claude AI 투자조언 | Claude 스트리밍 API |
| F4 | 띠/별자리 일일 운세 생성·캐시 | Gemini 배치 + DB 테이블 |
| F5 | 나의 띠·별자리 입력 후 오늘 운세 노출 | DB 컬럼 + API + UI |
| F6 | MBTI + 투자성향 + 운세 → 통합 AI 투자조언 | Claude 스트리밍 API |

---

## 아키텍처 개요

```
[AI 역할 분담]
Gemini  → 띠 12개 + 별자리 12개 운세 배치 생성 (매일 01:00 KST, DB 캐시)
Claude  → 사용자별 투자조언 스트리밍 (on-demand, 로그인 필수)

[기존 패턴 재사용]
- Gemini 서비스:  apps/admin/app/services/supply_summary_gemini_service.py 패턴
- Claude 스트리밍: docs/JUBTI_AI_STRATEGY_PLAN.md 패턴
- 포인트 적립:    apps/admin/app/services/member_point_service.py 패턴
- DB 마이그레이션: apps/admin/app/migrations/add_jubti_type_column.py 패턴
- API 프록시:     apps/web_new/app/api/auth/member/jubti/route.ts 패턴
```

---

## DB 스키마 변경

### 1. members 테이블 — 컬럼 3개 추가

```sql
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS mbti_type     VARCHAR(10) NULL,  -- INTJ, ENFP 등 16유형
  ADD COLUMN IF NOT EXISTS zodiac_animal VARCHAR(20) NULL,  -- 쥐|소|호랑이|...|돼지
  ADD COLUMN IF NOT EXISTS zodiac_sign   VARCHAR(30) NULL;  -- 양자리|황소자리|...
```

**포인트 지급 (최초 입력 시):**
- `mbti_type` 최초 입력: **+50P** (`idempotency_key: "mbti_first_{member_id}"`)
- `zodiac_animal` 최초 입력: **+30P** (`idempotency_key: "zodiac_animal_first_{member_id}"`)
- `zodiac_sign` 최초 입력: **+30P** (`idempotency_key: "zodiac_sign_first_{member_id}"`)

### 2. daily_fortunes 신규 테이블

```python
class DailyFortune(Base):
    __tablename__ = "daily_fortunes"
    id             = Column(Integer, primary_key=True)
    fortune_date   = Column(Date, nullable=False, index=True)   # KST 날짜
    fortune_type   = Column(String(10), nullable=False)          # "animal" | "sign"
    key            = Column(String(30), nullable=False)          # "쥐" | "양자리" 등
    fortune_text   = Column(Text, nullable=False)                # 운세 본문 (2~3문장)
    investment_tip = Column(Text, nullable=True)                 # 투자 한줄 팁
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("fortune_date", "fortune_type", "key", name="uq_daily_fortune"),
    )
```

---

## 변경/신규 파일 목록

### Backend — apps/admin/

| 파일 | 유형 | 내용 |
|------|------|------|
| `app/engine/models.py` | 수정 | `Member`에 컬럼 3개 추가, `DailyFortune` 클래스 추가 |
| `app/migrations/add_mbti_zodiac_columns.py` | 신규 | members 컬럼 3개 추가 마이그레이션 |
| `app/migrations/create_daily_fortunes_table.py` | 신규 | daily_fortunes 테이블 생성 마이그레이션 |
| `app/services/member_point_service.py` | 수정 | `grant_mbti_first_bonus`, `grant_zodiac_animal_first_bonus`, `grant_zodiac_sign_first_bonus` 추가 |
| `app/services/daily_fortune_gemini_service.py` | 신규 | 띠/별자리 운세 Gemini 생성·저장 서비스 |
| `app/services/scheduler_service.py` | 수정 | `DailyFortuneScheduler` (매일 01:00 KST) 추가 |
| `app/routers/auth.py` | 수정 | MBTI GET/PUT, 띠·별자리 GET/PUT 엔드포인트 4개 추가 |
| `app/routers/api.py` | 수정 | `GET /api/fortune/today` 추가 (공개 엔드포인트) |
| `app/main.py` | 수정 | `daily_fortune_scheduler` start/shutdown 등록 |

### Frontend — apps/web_new/

| 파일 | 유형 | 내용 |
|------|------|------|
| `app/components/module/home/JubtiSection.tsx` | 수정 | 리브랜딩 텍스트 + MBTI 16유형 선택기 + Claude AI 스트리밍 버튼 |
| `app/components/module/home/JubtiSection.module.css` | 수정 | MBTI 셀렉터·AI 버튼·스트리밍 박스 스타일 추가 |
| `app/components/module/home/FortuneSection.tsx` | 신규 | 띠·별자리 입력·운세 표시·통합 AI 조언 컴포넌트 |
| `app/components/module/home/FortuneSection.module.css` | 신규 | 운세 카드 스타일 (황금/보라 그라디언트) |
| `app/page.tsx` | 수정 | `<FortuneSection />` — JubtiSection 아래 추가 |
| `app/api/auth/member/mbti/route.ts` | 신규 | GET/PUT 프록시 |
| `app/api/auth/member/zodiac/route.ts` | 신규 | GET/PUT 프록시 |
| `app/api/fortune/today/route.ts` | 신규 | 운세 조회 프록시 (인증 불필요) |
| `app/api/jubti-strategy/route.ts` | 신규 | Claude 스트리밍 — F3: 투자전략 + MBTI |
| `app/api/mbti-investment-advice/route.ts` | 신규 | Claude 스트리밍 — F6: 통합 조언 |
| `lib/jubti/jubtiMasters.ts` | 수정 | `MBTI_TO_JUBTI`, `MBTI_DESCRIPTIONS`, `ZODIAC_ANIMAL_TRAITS` 상수 추가 |
| `lib/utils/zodiacUtils.ts` | 신규 | 월·일 → 별자리 자동계산 유틸 |

---

## 컴포넌트 UX 흐름

### JubtiSection 수정 (F1 · F2 · F3)

```
접힌 상태: "MBTI로 보는 투자성향" 버튼
  └→ 퀴즈 화면: 기존 7문항 (A/D/N/I 결과)
  └→ 결과 화면:
       ├─ 투자성향 히어로 카드 (기존 유지)
       ├─ [내 MBTI 입력하기] 버튼
       │   └→ 4×4 그리드 16유형 선택기
       │       (기존 mbti_type 있으면 선택 상태로 표시)
       ├─ MBTI × 투자성향 연결 설명 (예: ENFP는 공격형 투자자 성향)
       ├─ [✨ AI 투자전략 추천받기] 버튼 (F3 — 로그인 필수)
       │   └→ Claude 스트리밍 마크다운 렌더링
       └─ 저장하기 / 다시하기
```

### FortuneSection 신규 (F4 · F5 · F6)

```
접힌 상태: "오늘의 운세" 버튼
  └→ 미설정 상태: 설정 가이드 카드
       ├─ Step 1: 띠 12개 이모지 그리드 선택
       └─ Step 2: 별자리 12개 선택 OR 생년월일 입력 → 자동 계산
  └→ 설정 완료: 운세 카드 2장 표시
       ├─ 띠 운세 카드 (황금 그라디언트)
       │   └─ fortune_text (2~3문장) + investment_tip
       ├─ 별자리 운세 카드 (보라 그라디언트)
       │   └─ fortune_text (2~3문장) + investment_tip
       └─ [🌟 오늘의 AI 투자 종합 조언] 버튼 (F6 — 로그인 필수)
           └→ Claude 스트리밍: MBTI + 투자성향 + 오늘 운세 통합
```

---

## API 명세

### 백엔드 FastAPI (신규)

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/auth/member/mbti?email=` | X-API-KEY | MBTI 조회 |
| PUT | `/api/auth/member/mbti` | X-API-KEY | MBTI 저장 (최초 +50P) |
| GET | `/api/auth/member/zodiac?email=` | X-API-KEY | 띠·별자리 조회 |
| PUT | `/api/auth/member/zodiac` | X-API-KEY | 띠·별자리 저장 (각 최초 +30P) |
| GET | `/api/fortune/today?fortune_type=&key=` | 없음 | 오늘의 운세 조회 (공개) |

### 프론트엔드 Next.js (신규)

| Method | Path | 설명 |
|--------|------|------|
| GET/PUT | `/api/auth/member/mbti` | JWT → FastAPI 프록시 |
| GET/PUT | `/api/auth/member/zodiac` | JWT → FastAPI 프록시 |
| GET | `/api/fortune/today` | FastAPI 프록시 (공개) |
| POST | `/api/jubti-strategy` | Claude 스트리밍 — F3 투자전략 |
| POST | `/api/mbti-investment-advice` | Claude 스트리밍 — F6 통합 조언 |

---

## MBTI → 투자성향 매핑

```typescript
// apps/web_new/lib/jubti/jubtiMasters.ts 에 추가
export const MBTI_TO_JUBTI: Record<string, JubtiDimension> = {
  INTJ: "N", INTP: "N", ENTJ: "N", ENTP: "N",  // 분석형 (N)
  ISTJ: "D", ISFJ: "D", ESTJ: "D", ESFJ: "D",  // 방어형 (D)
  ISTP: "A", ESTP: "A", ENFJ: "A", ENFP: "A",  // 공격형 (A)
  INFJ: "I", INFP: "I", ESFP: "I", ISFP: "I",  // 직관형 (I)
};
```

---

## AI 프롬프트 설계

### Gemini — 띠/별자리 운세 배치 생성 (F4)

매일 01:00 KST에 APScheduler CronTrigger로 실행. Gemini 호출 2회.

**호출 1 — 띠 운세 (12개 배치)**
```
오늘 {date} 한국 12띠별 투자 운세를 작성해주세요.
반드시 아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {"animal": "쥐", "fortune": "운세 2~3문장. 재물·투자 흐름 포함.", "investment_tip": "투자 포인트 1문장"},
  ...
]
규칙:
- fortune: 일상 운세 + 투자/재물 분위기 자연스럽게 2~3문장
- investment_tip: 구체적 투자 행동 또는 주의사항 1문장
- 12띠 모두 포함: 쥐, 소, 호랑이, 토끼, 용, 뱀, 말, 양, 원숭이, 닭, 개, 돼지
- 순수 JSON 배열만 출력 (마크다운 없이)
```

**호출 2 — 별자리 운세 (12개 배치)**
```
오늘 {date} 서양 12별자리별 투자 운세를 작성해주세요.
반드시 아래 JSON 배열 형식으로만 응답하세요:
[
  {"sign": "양자리", "fortune": "운세 2~3문장. 별자리 특성 반영, 투자 흐름 포함.", "investment_tip": "투자 포인트 1문장"},
  ...
]
규칙:
- fortune: 별자리 고유 특성(양자리=적극성, 황소자리=안정 등) + 오늘 투자 기운 2~3문장
- investment_tip: 오늘 투자 행동 지침 1문장
- 12별자리 모두 포함
- 순수 JSON 배열만 출력
```

**파싱 전략**: `re.search(r'\[.*\]', text, re.DOTALL)` → 실패 시 각 항목 개별 재호출  
**폴백**: 오늘 DB에 데이터 없으면 실시간 생성 후 저장

---

### Claude — F3 투자전략 (`/api/jubti-strategy`)

**입력**: `jubti_type`, `mbti_type` (nullable), `scores`, `character_name`, `master`

```
당신은 초보 투자자를 위한 친절한 금융 교육 AI입니다.

## 사용자 프로필
- 주BTI 투자 유형: {jubti_label} — {jubti_style}
- 캐릭터: {character_name} / 닮은 투자 대가: {master}
- 점수 분포: A:{scores.A} D:{scores.D} N:{scores.N} I:{scores.I}
{mbti_line}  ← mbti_type 있을 때만 포함: "- MBTI: ENFP — {mbti_description}"

## 요청 (마크다운)
1. **핵심 투자 철학** — 이 조합이 만드는 투자 철학 2~3문장
2. **추천 투자 방식** — 구체적 전략 3가지 (각 2~3문장, MBTI 시너지 반영)
3. **주의해야 할 함정** — 이 조합이 빠지기 쉬운 실수 2가지
4. **첫 걸음 액션플랜** — 당장 실천 가능한 3단계

초보자도 이해 가능한 쉬운 언어, 친근·격려 톤으로 작성.
max_tokens: 1024
```

---

### Claude — F6 통합 투자조언 (`/api/mbti-investment-advice`)

**입력**: `jubti_type`, `mbti_type`, `zodiac_animal`, `zodiac_sign`, `animal_fortune`, `sign_fortune`, `scores`

```
당신은 재미있고 친근한 금융 AI입니다.
오늘의 운세와 투자 성향, MBTI를 결합하여 오늘 하루의 투자 방향을 조언해주세요.

## 사용자 프로필
- MBTI: {mbti_type} ({mbti_description})
- 주BTI 투자 유형: {jubti_label} — {jubti_style}
- 캐릭터: {character_name}
- 점수 분포: A:{A} D:{D} N:{N} I:{I}

## 오늘의 운세
### 띠 운세 ({zodiac_animal})
{animal_fortune.fortune_text}
투자 팁: {animal_fortune.investment_tip}

### 별자리 운세 ({zodiac_sign})
{sign_fortune.fortune_text}
투자 팁: {sign_fortune.investment_tip}

## 요청 (마크다운)
1. **오늘의 투자 기운 종합** — 운세+성향+MBTI를 종합한 오늘의 투자 흐름 3~4문장
2. **오늘 특히 주의할 점** — 이 조합에서 오늘 조심할 투자 실수 1~2가지
3. **오늘의 한 가지 액션** — 오늘 당장 실천 가능한 구체적 투자 행동 1가지

가볍고 재미있게, 하지만 투자 교육 가치도 담아주세요.
"재미로 보는" 운세임을 유머스럽게 인정하면서 실질적 조언도 제공.
max_tokens: 1024
```

**비용 최적화**: 동일 날짜 + 동일 조합은 sessionStorage 캐시로 중복 호출 방지

---

## 별자리 자동계산 유틸 (`lib/utils/zodiacUtils.ts`)

```typescript
const ZODIAC_SIGN_RANGES = [
  { sign: "양자리",     start: [3,21],  end: [4,19]  },
  { sign: "황소자리",   start: [4,20],  end: [5,20]  },
  { sign: "쌍둥이자리", start: [5,21],  end: [6,20]  },
  { sign: "게자리",     start: [6,21],  end: [7,22]  },
  { sign: "사자자리",   start: [7,23],  end: [8,22]  },
  { sign: "처녀자리",   start: [8,23],  end: [9,22]  },
  { sign: "천칭자리",   start: [9,23],  end: [10,22] },
  { sign: "전갈자리",   start: [10,23], end: [11,21] },
  { sign: "사수자리",   start: [11,22], end: [12,21] },
  { sign: "염소자리",   start: [12,22], end: [1,19]  },
  { sign: "물병자리",   start: [1,20],  end: [2,18]  },
  { sign: "물고기자리", start: [2,19],  end: [3,20]  },
];

export function getZodiacSignFromDate(month: number, day: number): string | null { ... }
```

---

## 마이그레이션 실행 순서

1. `add_mbti_zodiac_columns.py` — members 컬럼 3개 추가
2. `create_daily_fortunes_table.py` — daily_fortunes 테이블 생성
3. `models.py` 업데이트 (SQLAlchemy 모델 동기화)
4. 서비스/라우터 코드 배포
5. 첫 배포 시 `generate_daily_fortunes()` 수동 호출 → 초기 운세 24행 생성

---

## 검증 방법

### 백엔드
- `PUT /api/auth/member/mbti` → DB `members.mbti_type` 업데이트 확인 + `member_point_ledgers` 포인트 원장 확인
- `PUT /api/auth/member/zodiac` → `zodiac_animal`, `zodiac_sign` 업데이트 + 포인트 확인
- `GET /api/fortune/today?fortune_type=animal&key=쥐` → `fortune_text`, `investment_tip` 반환 확인
- 스케줄러 수동 실행 → `daily_fortunes` 테이블 24행(띠 12 + 별자리 12) 생성 확인

### 프론트엔드
- JubtiSection: 퀴즈 완료 → MBTI 16유형 선택 → 저장 → F3 AI 버튼 클릭 → 스트리밍 텍스트 렌더링
- FortuneSection: 띠·별자리 선택 → 저장 → 운세 카드 2장 표시 → F6 통합 AI 버튼 → 스트리밍 렌더링
- 비로그인 상태: F3/F6 버튼 클릭 시 로그인 유도 메시지 확인
- 재방문 시: 저장된 MBTI/zodiac 값 자동 로드 확인
