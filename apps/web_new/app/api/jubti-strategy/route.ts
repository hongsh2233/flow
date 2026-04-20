import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MBTI_INVEST_DESCRIPTION } from "@/lib/jubti/jubtiMasters";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

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

  const grade = ((session.user as { grade?: string }).grade ?? "regular").trim().toLowerCase();
  if (grade !== "vip" && grade !== "family") {
    return NextResponse.json({ success: false, message: "VIP 이상 회원만 이용할 수 있습니다." }, { status: 403 });
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

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }], role: "user" }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  );

  if (!geminiRes.ok || !geminiRes.body) {
    return NextResponse.json({ success: false, message: "AI 서비스 오류" }, { status: 502 });
  }

  const upstream = geminiRes.body;
  return new Response(
    new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const text: string | undefined = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* ignore malformed chunk */ }
          }
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
