"""
AI 로직 관리 페이지
- 모닝 브리핑: 관리자 입력 → Gemini 문장 생성 → B001/시황 카테고리에 pending 상태로 등록
"""
import re
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app import models
from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.services.gemini_response_utils import extract_text_from_generate_content_response

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/admin/ai-logic/morning-briefing", response_class=HTMLResponse)
async def ai_morning_briefing_page(
    request: Request,
    user=Depends(get_current_user),
):
    if not user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse(
        "ai_morning_briefing.html",
        {"request": request, "active_page": "ai-morning-briefing"},
    )


@router.post("/admin/ai-logic/morning-briefing/generate")
async def ai_morning_briefing_generate(
    request: Request,
    user_input: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return JSONResponse({"success": False, "error": "로그인이 필요합니다."}, status_code=401)
    if not user_input.strip():
        return JSONResponse({"success": False, "error": "입력 내용이 없습니다."})
    if not GEMINI_API_KEY:
        return JSONResponse({"success": False, "error": "GEMINI_API_KEY가 설정되지 않았습니다."})

    # Gemini 호출
    prompt = _build_morning_briefing_prompt(user_input.strip())
    content_html = _call_gemini_for_briefing(prompt)
    if not content_html:
        return JSONResponse({"success": False, "error": "Gemini 응답 생성에 실패했습니다. 다시 시도해 주세요."})

    # 제목 생성
    kst = pytz.timezone("Asia/Seoul")
    now_kst = datetime.now(kst)
    title = f"[모닝브리핑] {now_kst.year}년 {now_kst.month}월 {now_kst.day}일"

    # 시황 카테고리 ID 조회
    category_id = None
    try:
        cat = (
            db.query(models.BoardCategory)
            .filter(models.BoardCategory.board_id == "B001", models.BoardCategory.name == "시황")
            .first()
        )
        if cat:
            category_id = cat.id
        else:
            print("[ai-logic] 시황 카테고리 없음 (category_id=None으로 등록)")
    except Exception as e:
        print(f"[ai-logic] 카테고리 조회 오류: {e}")

    # B001 게시판에 pending 상태로 등록
    try:
        new_post = models.Post(
            board_id="B001",
            title=title,
            content=content_html,
            author="플로우AI",
            status="pending",
            category_id=category_id,
            created_at=now_kst,
            updated_at=now_kst,
        )
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        return JSONResponse({
            "success": True,
            "post_id": new_post.id,
            "title": title,
            "category_id": category_id,
            "content": content_html,
            "message": f"게시글이 생성되었습니다 (승인 대기 중). 제목: {title}",
        })
    except Exception as e:
        db.rollback()
        print(f"[ai-logic] 게시글 저장 오류: {e}")
        return JSONResponse({"success": False, "error": f"게시글 저장 오류: {e}"})


def _build_morning_briefing_prompt(user_input: str) -> str:
    return f"""다음 내용을 바탕으로 한국 개인 주식 투자자를 위한 모닝 브리핑 게시글을 작성해 주세요.

[관리자 입력 내용]
{user_input}

작성 규칙:
- 자연스러운 한국어 문장으로 작성
- 오늘 주목할 주요 내용, 시장 흐름, 투자 포인트를 중심으로 구성
- 각 항목은 2~3문장으로 명확하게 서술
- 전체 분량은 300~600자 내외
- HTML 형식으로 작성 (h3 태그로 소제목, p 태그로 본문)
- 마지막에 반드시 다음 면책 문구를 포함:
  <p style="margin-top:24px;font-size:12px;color:#999;">※ 본 브리핑은 AI가 생성한 참고 자료로, 투자 판단의 최종 책임은 투자자 본인에게 있습니다.</p>

응답은 HTML 본문만 출력하세요. 다른 설명이나 마크다운 코드블록(```)은 포함하지 마세요."""


def _call_gemini_for_briefing(prompt: str) -> Optional[str]:
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        text = extract_text_from_generate_content_response(
            response, log_prefix="ai-logic-morning", log_if_empty=True
        )
        # 코드블록 제거
        text = re.sub(r"```(?:html)?\s*", "", text)
        text = re.sub(r"```", "", text)
        return text.strip() if text.strip() else None
    except Exception as e:
        print(f"[ai-logic] Gemini 호출 오류: {e}")
        return None
