"""
google-genai `GenerateContentResponse`에서 텍스트·JSON 블록 추출 (관리자 Gemini 호출 공통).
"""
from __future__ import annotations

from typing import Any, Optional


def _is_thought_part(part: Any) -> bool:
    t = getattr(part, "thought", None)
    return t is True or (isinstance(t, bool) and t)


def extract_text_from_generate_content_response(
    response: Any,
    *,
    log_prefix: str = "gemini",
    log_if_empty: bool = False,
) -> str:
    """
    SDK 버전에 따라 response.text(권장) → parts → candidates 순으로 텍스트를 모은다.
    thought(추론) 파트는 제외한다.
    """
    # 1) 공식 권장: GenerateContentResponse.text (내부에서 thought 제외)
    try:
        raw = response.text
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    except Exception:
        pass

    text = ""
    parts = getattr(response, "parts", None)
    if parts:
        for part in parts:
            if _is_thought_part(part):
                continue
            pt = getattr(part, "text", None)
            if pt:
                text += str(pt)
    if text.strip():
        return text.strip()

    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        if not content:
            continue
        chunk = ""
        for part in getattr(content, "parts", None) or []:
            if _is_thought_part(part):
                continue
            pt = getattr(part, "text", None)
            if pt:
                chunk += str(pt)
        if chunk:
            return chunk.strip()

    if log_if_empty:
        pf = getattr(response, "prompt_feedback", None)
        block_reason = getattr(pf, "block_reason", None) if pf else None
        n_cand = len(getattr(response, "candidates", None) or [])
        print(
            f"[{log_prefix}] Gemini 빈 응답 — candidates={n_cand}, "
            f"prompt_feedback.block_reason={block_reason}"
        )
    return ""


def extract_first_json_object(text: str) -> Optional[str]:
    """첫 번째 최상위 `{ ... }` 블록을 괄호 균형으로 잘라낸다 (문자열 리터럴 안의 `{` `}` 는 무시)."""
    if not text:
        return None
    brace = text.find("{")
    if brace < 0:
        return None
    depth = 0
    in_string = False
    escape = False
    for i, c in enumerate(text[brace:], start=brace):
        if in_string:
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if c == '"':
                in_string = False
            continue
        if c == '"':
            in_string = True
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[brace : i + 1]
    return None
