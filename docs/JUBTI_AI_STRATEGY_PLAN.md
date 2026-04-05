# 주BTI 결과 기반 AI 투자전략 추천 기능 계획

## 개요

주BTI 테스트 결과(A/D/N/I 성향)를 Claude AI에 전달하여, 사용자의 투자 성향에 맞는 맞춤형 투자전략을 추천받는 기능.

---

## 사용자 플로우

```
1. 사용자가 주BTI 테스트 완료 → 결과 타입 확정 (A / D / N / I)
2. 결과 화면 하단에 "AI 투자전략 추천받기" 버튼 노출
3. 버튼 클릭 → 로그인 확인 (미로그인 시 로그인 유도)
4. 로그인 시 Claude AI 호출 → 스트리밍 응답 표시
5. 결과 화면에 마크다운 렌더링 (접기/펼치기 가능)
6. 저장 버튼으로 마이페이지에 보관 (선택)
```

---

## 아키텍처

### 1. 프론트엔드 변경

#### `apps/web_new/app/components/module/home/JubtiSection.tsx`

결과 화면(`finished === true` 블록)에 AI 추천 섹션 추가:

```tsx
// 상태 추가
const [aiStrategy, setAiStrategy] = useState<string>("");
const [aiLoading, setAiLoading] = useState(false);
const [aiError, setAiError] = useState<string>("");

// AI 추천 핸들러
const handleAiStrategy = async () => {
  if (!session?.user?.email) {
    setShowLoginMessage(true);
    return;
  }
  setAiLoading(true);
  setAiStrategy("");
  setAiError("");

  const res = await fetch("/api/jubti-strategy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jubti_type: mainType,                    // "A" | "D" | "N" | "I"
      scores: { A: scores.A, D: scores.D, N: scores.N, I: scores.I },
      character_name: meta.characterName,
      master: meta.master,
    }),
  });

  // 스트리밍 응답 처리
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    setAiStrategy((prev) => prev + decoder.decode(value));
  }
  setAiLoading(false);
};
```

결과 화면에 버튼 + 응답 영역 추가:

```tsx
<button
  type="button"
  className={styles.aiStrategyBtn}
  onClick={handleAiStrategy}
  disabled={aiLoading}
>
  {aiLoading ? "AI 분석 중..." : "✨ AI 투자전략 추천받기"}
</button>

{aiStrategy && (
  <div className={styles.aiStrategyBox}>
    <h4>AI 맞춤 투자전략</h4>
    <ReactMarkdown>{aiStrategy}</ReactMarkdown>
  </div>
)}
```

---

### 2. API Route 신규 생성

#### `apps/web_new/app/api/jubti-strategy/route.ts`

```typescript
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const client = new Anthropic();

const TYPE_CONTEXT = {
  A: { label: "공격형 (불나방 파이터)", style: "고위험·고수익 추구, 변동성 선호" },
  D: { label: "방어형 (철벽 거북이)", style: "안정성 최우선, 장기 배당·우량주 선호" },
  N: { label: "분석형 (돋보기 탐정)", style: "데이터 기반 의사결정, 재무제표 분석 중시" },
  I: { label: "직관형 (촉 좋은 야생마)", style: "트렌드·감각 기반, 빠른 판단력" },
};

export async function POST(req: NextRequest) {
  // 인증 확인
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { jubti_type, scores, character_name, master } = await req.json();
  const ctx = TYPE_CONTEXT[jubti_type as keyof typeof TYPE_CONTEXT];

  const prompt = `
당신은 초보 투자자를 위한 친절한 금융 교육 AI입니다.
사용자의 주BTI 투자 성향 테스트 결과를 기반으로 맞춤형 투자전략을 추천해 주세요.

## 사용자 투자 성향
- 유형: ${ctx.label}
- 캐릭터: ${character_name}
- 닮은 투자 대가: ${master}
- 성향 설명: ${ctx.style}
- 세부 점수: 공격형(A) ${scores.A}점, 방어형(D) ${scores.D}점, 분석형(N) ${scores.N}점, 직관형(I) ${scores.I}점

## 요청
위 성향을 바탕으로 아래 항목을 작성해 주세요:

1. **핵심 투자 철학** (2~3문장)
2. **추천 투자 방식** (구체적인 전략 3가지, 각 2~3문장)
3. **주의해야 할 함정** (이 성향이 빠지기 쉬운 실수 2가지)
4. **첫 걸음 액션플랜** (당장 실천 가능한 3단계)

초보자도 이해할 수 있는 쉬운 언어로, 친근하고 격려하는 톤으로 작성해 주세요.
각 항목은 마크다운 형식으로 작성하되, 너무 길지 않게 핵심만 담아주세요.
  `.trim();

  // 스트리밍 응답
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
```

---

### 3. 의존성 추가

```bash
# Claude SDK (이미 설치된 경우 생략)
npm install @anthropic-ai/sdk

# 마크다운 렌더링
npm install react-markdown
```

환경변수 (`apps/web_new/.env.local`):
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### 4. CSS 추가 (`JubtiSection.module.css`)

```css
.aiStrategyBtn {
  width: 100%;
  padding: 0.75rem;
  margin-top: 1rem;
  border: none;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.aiStrategyBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.aiStrategyBox {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--app-border-light);
  border-radius: 0.75rem;
  background: var(--app-bg-secondary);
  font-size: 0.85rem;
  line-height: 1.7;
}
```

---

## 변경 파일 요약

| 파일 | 유형 | 내용 |
|------|------|------|
| `apps/web_new/app/components/module/home/JubtiSection.tsx` | 수정 | AI 추천 버튼·상태·스트리밍 렌더링 추가 |
| `apps/web_new/app/components/module/home/JubtiSection.module.css` | 수정 | `aiStrategyBtn`, `aiStrategyBox` 스타일 추가 |
| `apps/web_new/app/api/jubti-strategy/route.ts` | 신규 | Claude API 호출 스트리밍 응답 API Route |
| `apps/web_new/.env.local` | 수정 | `ANTHROPIC_API_KEY` 추가 |
| `package.json` | 수정 | `@anthropic-ai/sdk`, `react-markdown` 설치 |

---

## 고려사항

- **비용 관리**: 1회 호출당 ~$0.003 (1K 토큰 기준). 무분별한 반복 호출 방지를 위해 결과를 세션에 캐싱하거나, 로그인 유저만 허용.
- **응답 캐싱**: 동일 jubti_type은 응답이 유사하므로, Redis/DB에 캐싱하여 중복 API 비용 절감 가능.
- **마크다운 렌더링**: `react-markdown` 대신 가벼운 `marked` 라이브러리도 고려 가능.
- **저장 기능**: 마이페이지에서 AI 추천 결과를 다시 볼 수 있도록 DB 컬럼(`jubti_ai_strategy text`) 추가 및 저장 API 구현 가능.
- **프롬프트 개선**: 실제 시장 데이터(현재 금리, 인기 종목 등)를 함께 전달하면 더 맥락 있는 추천 가능.
