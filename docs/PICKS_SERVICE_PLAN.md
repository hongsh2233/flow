# 추천종목(Picks) 서비스 기획서

> 작성일: 2026-03-27
> 대상 앱: Jurin-i (주린이) — Next.js + FastAPI 모노레포

---

## 1. 서비스 개요

### 목적
- BO(백오피스) 스크리닝 엔진이 검출한 AI 추천 종목을 회원에게 노출
- 관리자(작가)가 직접 픽한 종목의 모의 매매 수익률을 공개해 체류 시간과 전환율 향상
- 증권사 MTS 연결 버튼으로 실제 매매 전환 유도

### 핵심 원칙
- **회원전용 완전 열람** — 비회원은 종목명·코드 `***` 블라인드
- **투자권유 아님** 법적 고지 필수 노출
- BO 데이터 기반 (스크리닝 결과: `stock_screening_results`, `jongbe_screening_results`)
- 관리자 픽은 별도 `stock_picks` 테이블로 관리

---

## 2. IA (Information Architecture)

```
/ (홈)
└── [AI 추천 미리보기 섹션] ← NEW (2종목, 비회원 ***)
    └── "전체 보기" →

/picks                        ← NEW 메인 페이지
├── [상단 고지 배너]           - 회원전용 / 투자권유 아님
├── [증권사 연결 버튼]         - localStorage 저장, 미선택 시 선택 레이어 오픈
├── [AI 추천 종목 탭]
│   ├── 탭: 일목 (코스피/코스닥)
│   └── 탭: 종베 (코스피/코스닥)
└── [작가 픽 / 모의 매매 수익률] - 관리자가 등록한 픽
```

---

## 3. 화면 기획

### 3-1. 홈 미리보기 섹션 (`AiPicksPreview`)

위치: 홈 페이지 `JubtiSection` 위쪽 (관심종목 아래)

```
┌─────────────────────────────────────┐
│  🤖 AI 추천 종목          [전체보기 →] │
│  ⚠️ 회원전용 · 투자권유 아님          │
├─────────────────────────────────────┤
│  #1  [***]      +2.34%  코스피      │  ← 비회원
│  #2  [***]      +1.10%  코스닥      │  ← 비회원
├─────────────────────────────────────┤
│  #1  삼성전자   +2.34%  코스피      │  ← 회원
│  #2  SK하이닉스 +1.10%  코스닥      │  ← 회원
└─────────────────────────────────────┘
```

- 최신 스크리닝 결과 rank 1위 2개 노출 (일목 기준)
- 비회원: 종목명 `***`, 코드 `***`, 등락률/현재가 blur 처리
- "로그인하고 전체 보기" CTA 버튼

---

### 3-2. 추천종목 전체 페이지 (`/picks`)

#### [A] 상단 고지 배너
```
┌─────────────────────────────────────────┐
│ 🔒 회원전용 서비스입니다.                  │
│    본 내용은 투자권유가 아니며, 투자 판단과│
│    책임은 본인에게 있습니다.               │
└─────────────────────────────────────────┘
```
- 항상 노출 (회원/비회원 공통)
- 닫기 버튼 없음 (법적 고지)

---

#### [B] 증권사 연결 버튼

```
[미선택 상태]
┌──────────────────────────────────┐
│  🏦 증권사를 선택하세요  [선택 ▼] │
└──────────────────────────────────┘

[선택 후]
┌──────────────────────────────────┐
│  [키움 로고] 키움증권  [변경]  [바로가기 →] │
└──────────────────────────────────┘
```

- 클릭 → 증권사 선택 레이어(바텀시트) 오픈
- 선택한 증권사는 `localStorage["selected_broker"]`에 저장
- "바로가기" 클릭:
  - 앱 환경(`Capacitor`): `android_intent` → 설치 없으면 `android_store`
  - 웹 환경: `mobile_web` URL 새탭 오픈

---

#### [B-1] 증권사 선택 레이어 (바텀시트)

```
┌─────────────────────────────────────────┐
│  증권사 선택            [✕ 닫기]         │
├─────────────────────────────────────────┤
│  [삼성] [미래에셋] [한국투자] [NH투자]   │
│  [KB]  [신한]    [키움]    [대신]       │
│  [메리츠] [하나] [이베스트] [토스]      │
│  [카카오페이] [유안타] [현대차]         │
├─────────────────────────────────────────┤
│  * 선택한 증권사의 MTS 앱으로 연결됩니다│
└─────────────────────────────────────────┘
```

- `/api/brokers` 에서 목록 로드 (BO의 `BROKERS` 상수)
- 각 항목: 증권사명 + 브랜드 컬러 동그라미 아이콘
- 선택 즉시 바텀시트 닫힘, 버튼 영역 업데이트

---

#### [C] AI 추천 종목 탭

```
┌───────────────────────────────────────────┐
│  AI 추천 종목                              │
│  ┌──────────┬──────────┐                  │
│  │ 일목균형표│ 종가베팅  │  ← 스크리닝 타입 탭
│  └──────────┴──────────┘                  │
│  ┌────────┬──────────┐                   │
│  │ 코스피 │ 코스닥   │  ← 시장 탭         │
│  └────────┴──────────┘                   │
│                                           │
│  검출일: 2026-03-27 20:30                  │
│                                           │
│  순위  종목명    현재가   등락률  조건     │
│  ─────────────────────────────────────── │
│   1  삼성전자  78,500  +2.34%  A,B,E    │  ← 회원
│   2  ***       ***     ***      ***      │  ← 비회원
│   3  ***       ***     ***      ***      │  ← 비회원
│  ...                                     │
│                                           │
│  [🔒 로그인하고 전체 종목 보기]            │  ← 비회원 CTA
└───────────────────────────────────────────┘
```

**비회원 처리:**
- 1위만 공개, 2위부터 `***` blur 처리
- 종목명, 코드, 현재가, 등락률, 조건 모두 블라인드
- 하단 로그인 CTA 고정

**회원 처리:**
- 전체 목록 노출
- 종목명 클릭 → `StockDetailModal` (기존 컴포넌트 재사용)
- 조건 아이콘(A,B,E…) hover 시 조건 설명 툴팁

**스크리닝 조건 범례 (토글로 펼치기):**

| 코드 | 일목균형표 조건 |
|------|-------------|
| A | 전환선 > 기준선 |
| B | 주가 > 기준선 |
| E | 주가 > 구름대(선행스팬) 위 |
| G | 기준선 상승 중 |
| J | 120봉 신고가 |

| 코드 | 종가베팅 조건 |
|------|-------------|
| A | 시총 500억↑ |
| B | 거래대금 상위 |
| C | 등락률 +1~+10% |
| D | 양봉 |
| E | 고가 대비 98%↑ |
| F | 5MA 위 |
| G | RSI(14) 50↑ |
| H | 전일 거래량 비율 200%↑ |

---

#### [D] 작가 픽 / 모의 매매 수익률

```
┌────────────────────────────────────────────┐
│  📌 작가 픽  (모의 매매 기준)               │
│  ※ 실제 투자 결과와 다를 수 있습니다.       │
├────────────────────────────────────────────┤
│  종목명     매수가   현재가   수익률  보유일수│
│  ──────────────────────────────────────── │
│  삼성전자   76,000  78,500  +3.29%  5일   │
│  LG에너지   400,000 390,000 -2.50%  12일  │
│  ...                                      │
│                                            │
│  (비회원: 종목명 ***, 수익률 공개)           │
└────────────────────────────────────────────┘
```

**정책:**
- 관리자가 BO에서 종목 등록 (매수가, 매수일, 메모)
- 현재가는 프론트에서 `/api/fsc-stock-price` 또는 네이버 API로 실시간 조회
- 수익률 = `(현재가 - 매수가) / 매수가 × 100`
- 비회원: 종목명 `***`, 수익률/현재가/등락률은 공개 (참여 유도)
- 종료된 픽은 `is_closed=true`로 표시, 최종 수익률 고정 표시

---

## 4. DB 모델 추가

### `stock_picks` 테이블

```python
class StockPick(Base):
    __tablename__ = "stock_picks"

    id             = Column(Integer, primary_key=True)
    stock_code     = Column(String(10), nullable=False)   # 종목 코드
    stock_name     = Column(String(100), nullable=False)  # 종목명
    entry_price    = Column(Integer, nullable=False)       # 매수가 (원)
    entry_date     = Column(Date, nullable=False)          # 매수일
    close_price    = Column(Integer, nullable=True)        # 종료가 (청산 시)
    close_date     = Column(Date, nullable=True)           # 청산일
    is_closed      = Column(Boolean, default=False)        # 종료 여부
    note           = Column(Text, nullable=True)           # 메모/근거
    is_visible     = Column(Boolean, default=True)         # 노출 여부
    order_index    = Column(Integer, default=0)            # 정렬 순서
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, onupdate=func.now())
```

---

## 5. API 설계

### 5-1. 백엔드 (FastAPI) 신규 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/api/stock-picks` | 작가 픽 목록 | X-API-KEY |
| `POST` | `/api/admin/stock-picks` | 픽 등록 | 관리자 |
| `PUT` | `/api/admin/stock-picks/{id}` | 픽 수정/청산 | 관리자 |
| `DELETE` | `/api/admin/stock-picks/{id}` | 픽 삭제 | 관리자 |

**`GET /api/stock-picks` 응답:**
```json
{
  "success": true,
  "picks": [
    {
      "id": 1,
      "stock_code": "005930",
      "stock_name": "삼성전자",
      "entry_price": 76000,
      "entry_date": "2026-03-22",
      "is_closed": false,
      "note": "일목균형표 돌파, 거래량 급증",
      "order_index": 1
    }
  ]
}
```

기존 엔드포인트 활용:
- `GET /api/stock-screening?market_type=kospi&limit=20` — 일목균형표
- `GET /api/jongbe-screening?market_type=kospi&limit=20` — 종가베팅
- `GET /api/brokers` — 증권사 목록

### 5-2. 프론트엔드 BFF (Next.js API Routes)

| 경로 | 설명 |
|------|------|
| `/api/picks/stock-picks` | 백엔드 stock-picks 프록시 |
| `/api/picks/ai-screening` | 스크리닝 결과 프록시 (ichimoku + jongbe) |
| `/api/picks/brokers` | 증권사 목록 프록시 |

---

## 6. 컴포넌트 설계

```
apps/web_new/app/
├── picks/
│   └── page.tsx                        # 추천종목 메인 페이지
│
└── components/module/picks/
    ├── PicksDisclaimerBanner.tsx        # 고지 배너 (회원전용 · 투자권유 아님)
    ├── BrokerConnectButton.tsx          # 증권사 연결 버튼
    ├── BrokerSelectSheet.tsx            # 증권사 선택 바텀시트
    ├── AiScreeningSection.tsx           # AI 추천 종목 탭+테이블
    ├── ScreeningResultTable.tsx         # 종목 테이블 (블라인드 처리 포함)
    ├── ScreeningConditionLegend.tsx     # 조건 범례 토글
    ├── AuthorPickSection.tsx            # 작가 픽 섹션
    ├── AuthorPickCard.tsx               # 픽 카드 (수익률 표시)
    └── AiPicksPreview.tsx              # 홈 미리보기 (2종목)
```

---

## 7. 회원/비회원 차별화 매트릭스

| 요소 | 비회원 | 회원 |
|------|--------|------|
| 홈 미리보기 종목명 | `***` | 정상 표시 |
| 홈 미리보기 현재가/등락률 | blur | 정상 표시 |
| AI 추천 종목 1위 | 정상 표시 | 정상 표시 |
| AI 추천 종목 2위↑ | `***` + blur | 정상 표시 |
| 증권사 선택/연결 | 가능 | 가능 |
| 작가 픽 종목명 | `***` | 정상 표시 |
| 작가 픽 수익률 | 공개 (참여 유도) | 공개 |
| 작가 픽 메모/근거 | 비공개 | 공개 |

---

## 8. 하단 네비게이션 검토

현재 BottomNavigation 탭: 홈 / 브리핑 / 캘린더 / 마켓 / 주톡

`/picks`는 별도 탭 추가 OR 홈에서 진입하는 구조로 결정 필요.

**권장**: 홈 미리보기 카드에서 진입 (탭 추가 없이 기존 구조 유지)
- 추후 사용률 높으면 탭에 "픽" 추가 검토

---

## 9. 구현 순서 (Phase)

### Phase 1 — 백엔드 & 데이터 기반
1. `stock_picks` DB 모델 추가 (Alembic 마이그레이션)
2. `/api/stock-picks` CRUD 엔드포인트
3. BO 관리자 픽 관리 페이지 (`/admin/stock-picks`)

### Phase 2 — 프론트엔드 핵심
4. `/picks` 페이지 기본 구조
5. `PicksDisclaimerBanner` 컴포넌트
6. `AiScreeningSection` — 스크리닝 결과 탭 + 블라인드
7. `AuthorPickSection` — 픽 목록 + 수익률 계산

### Phase 3 — 증권사 연결
8. `BrokerSelectSheet` 바텀시트
9. `BrokerConnectButton` + localStorage 연동
10. Capacitor 딥링크 연동

### Phase 4 — 홈 통합
11. `AiPicksPreview` 홈 미리보기 섹션
12. 홈 `page.tsx`에 컴포넌트 삽입 (위치: `JubtiSection` 상단)

---

## 10. 기술적 고려사항

### 현재가 실시간 조회
- 작가 픽의 현재가는 클라이언트에서 종목 코드로 조회
- 기존 `StockDetailModal`과 동일하게 `/api/fsc-stock-price?code=005930` 활용
- 시세 오류 시 "시세 조회 실패" 표시, 수익률 `-` 처리

### 블라인드 처리 구현
```tsx
// 예시
const displayName = isLoggedIn ? stock.stock_name : "***";
const displayPrice = isLoggedIn ? stock.current_price : "---";
```
- CSS `filter: blur(4px)` + `user-select: none` 조합
- 일부 정보는 CSS blur, 핵심 정보는 아예 `***` 텍스트 치환

### 증권사 딥링크 (Capacitor)
```typescript
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

// 앱 환경이면 intent:// 시도, 실패 시 Play Store
if (Capacitor.isNativePlatform()) {
  window.location.href = broker.android_intent;
} else {
  window.open(broker.mobile_web, "_blank");
}
```

---

## 11. 용어 정리

| 용어 | 설명 |
|------|------|
| AI 추천 종목 | BO 스크리닝 엔진(일목균형표/종가베팅)이 자동 검출한 종목 |
| 일목 | 일목균형표 기반 스크리닝 (`stock_screening_results`) |
| 종베 | 종가베팅 기반 스크리닝 (`jongbe_screening_results`) |
| 작가 픽 | 관리자가 직접 등록한 추천 종목 + 매수가 |
| 모의 매매 | 실제 거래 없이 가상 매수가 기준 수익률을 추적 |
| 블라인드 | 비회원에게 `***` 또는 blur로 정보를 가리는 처리 |
