import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MBTI_INVEST_DESCRIPTION } from "@/lib/jubti/jubtiMasters";

const client = new Anthropic();

const TYPE_CONTEXT: Record<string, { label: string; style: string }> = {
  A: { label: "공격형 (불나방 파이터)", style: "고위험·고수익 추구, 변동성 선호, 레버리지 활용" },
  D: { label: "방어형 (철벽 거북이)", style: "안정성 최우선, 장기 배당·우량주 선호" },
  N: { label: "분석형 (돋보기 탐정)", style: "데이터 기반 의사결정, 재무제표 분석 중시" },
  I: { label: "직관형 (촉 좋은 야생마)", style: "트렌드·감각 기반, 빠른 판단력, 이벤트 포착" },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "로그인 후 이용 가능합니다." }, { status: 401 });
  }

  const { jubti_type, mbti_type, scores, character_name, master } = await req.json();
  const ctx = TYPE_CONTEXT[jubti_type as keyof typeof TYPE_CONTEXT];
  if (!ctx) return NextResponse.json({ success: false, message: "유효하지 않은 투자 유형입니다." }, { status: 400 });

  const mbtiDesc = mbti_type ? (MBTI_INVEST_DESCRIPTION[mbti_type] ?? "") : null;

  const prompt = `당신은 초보 투자자를 위한 친절한 금융 교육 AI입니다.
사용자의 투자 성향과 MBTI를 분석하여 맞춤형 투자전략을 추천해 주세요.

## 사용자 프로필
- 투자 유형: ${ctx.label}
- 캐릭터: ${character_name}
- 닮은 투자 대가: ${master}
- 투자 성향: ${ctx.style}
- 점수 분포: 공격형(A) ${scores?.A ?? 0}점, 방어형(D) ${scores?.D ?? 0}점, 분석형(N) ${scores?.N ?? 0}점, 직관형(I) ${scores?.I ?? 0}점
${mbtiDesc ? `- MBTI: ${mbti_type} — ${mbtiDesc}` : ""}

## 요청 (마크다운 형식)
1. **핵심 투자 철학** — 이 프로필 조합이 만들어내는 투자 철학 2~3문장
2. **추천 투자 방식** — 구체적 전략 3가지 (각 2~3문장${mbtiDesc ? ", MBTI 특성과 투자성향의 시너지 반영" : ""})
3. **주의해야 할 함정** — 이 조합이 빠지기 쉬운 실수 2가지
4. **첫 걸음 액션플랜** — 당장 실천 가능한 3단계

초보자도 이해할 수 있는 쉬운 언어로, 친근하고 격려하는 톤으로 작성해 주세요.`.trim();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
