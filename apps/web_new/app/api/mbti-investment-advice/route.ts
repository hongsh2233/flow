import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MBTI_INVEST_DESCRIPTION } from "@/lib/jubti/jubtiMasters";
import { API_BASE_URL, API_SECRET_KEY } from "@/lib/config/api";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const TYPE_CONTEXT: Record<string, { label: string; style: string }> = {
  A: { label: "공격형 (불나방 파이터)", style: "고위험·고수익 추구, 변동성 선호" },
  D: { label: "방어형 (철벽 거북이)", style: "안정성 최우선, 장기 배당·우량주 선호" },
  N: { label: "분석형 (돋보기 탐정)", style: "데이터 기반 의사결정, 재무제표 분석 중시" },
  I: { label: "직관형 (촉 좋은 야생마)", style: "트렌드·감각 기반, 빠른 판단력" },
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

  // 1일 사용 횟수 확인 + VIP 포인트 차감
  const chargeRes = await fetch(`${API_BASE_URL}/api/fortune-ai-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_SECRET_KEY ? { "X-API-KEY": API_SECRET_KEY } : {}),
    },
    body: JSON.stringify({ email: session.user.email }),
    cache: "no-store",
  });
  if (!chargeRes.ok) {
    const chargeData = await chargeRes.json().catch(() => ({}));
    const status = chargeRes.status === 429 ? 429 : 403;
    return NextResponse.json(
      { success: false, message: chargeData.detail ?? "이용 횟수를 초과했습니다." },
      { status }
    );
  }

  const { jubti_type, mbti_type, zodiac_animal, zodiac_sign, animal_fortune, sign_fortune, scores, character_name } =
    await req.json();

  const ctx = TYPE_CONTEXT[jubti_type as keyof typeof TYPE_CONTEXT];
  if (!ctx) return NextResponse.json({ success: false, message: "유효하지 않은 투자 유형입니다." }, { status: 400 });

  const mbtiDesc = mbti_type ? (MBTI_INVEST_DESCRIPTION[mbti_type] ?? "") : null;

  const prompt = `당신은 재미있고 친근한 금융 AI입니다.
오늘의 운세와 투자 성향, MBTI를 결합하여 오늘 하루의 투자 방향을 조언해주세요.

## 사용자 프로필
${mbtiDesc ? `- MBTI: ${mbti_type} (${mbtiDesc})` : ""}
- 투자 유형: ${ctx.label} — ${ctx.style}
- 캐릭터: ${character_name ?? ""}
- 점수 분포: A:${scores?.A ?? 0} D:${scores?.D ?? 0} N:${scores?.N ?? 0} I:${scores?.I ?? 0}

## 오늘의 운세
### 띠 운세 (${zodiac_animal ?? "미설정"})
${animal_fortune?.fortune_text ?? "운세 정보 없음"}
투자 팁: ${animal_fortune?.investment_tip ?? ""}

### 별자리 운세 (${zodiac_sign ?? "미설정"})
${sign_fortune?.fortune_text ?? "운세 정보 없음"}
투자 팁: ${sign_fortune?.investment_tip ?? ""}

## 요청 (마크다운 형식)
1. **오늘의 투자 기운 종합** — 운세+성향+MBTI를 종합한 오늘의 투자 흐름 3~4문장 (재미있고 인사이트 있게)
2. **오늘 특히 주의할 점** — 이 조합에서 오늘 조심해야 할 투자 실수 1~2가지
3. **오늘의 한 가지 액션** — 오늘 당장 실천 가능한 구체적 투자 행동 1가지

가볍고 재미있게, 하지만 투자 교육 가치도 담아주세요.
"재미로 보는" 운세임을 유머스럽게 인정하면서 실질적 조언도 제공해주세요.`.trim();

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
