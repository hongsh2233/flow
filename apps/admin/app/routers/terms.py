"""
콘텐츠 관리 라우터 - 개인정보처리방침, 이용약관, 플로우 앱 소개
"""
from fastapi import APIRouter, Form, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user, verify_api_key

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")

DOC_TYPES = {
    "privacy": ("개인정보처리방침", "privacy"),
    "terms": ("이용약관", "terms"),
    "about": ("플로우 앱", "about"),
}


def get_or_create_document(db: Session, doc_type: str) -> models.LegalDocument:
    doc = db.query(models.LegalDocument).filter(models.LegalDocument.doc_type == doc_type).first()
    if not doc:
        doc = models.LegalDocument(doc_type=doc_type, content="")
        db.add(doc)
        db.commit()
        db.refresh(doc)
    return doc


@router.get("/admin/terms/privacy", response_class=HTMLResponse)
async def admin_terms_privacy_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """개인정보처리방침 편집 페이지"""
    if not user:
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, "privacy")
    if not doc.content:
        doc.content = """플로우 개인정보처리방침

시행일: 2026년 3월 29일

플로우(이하 "서비스")를 운영하는 운영자(이하 "회사")는 「개인정보 보호법」 및 관련 법령에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속·정확하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.

■ 제1조 (수집하는 개인정보 항목 및 수집 방법)

[필수 항목]
• 이메일 주소 — 본인 확인, 로그인, 서비스 안내
• 비밀번호 (Bcrypt 암호화 저장) — 계정 보안
• 닉네임 — 서비스 내 식별
• 소셜 로그인 제공자 고유 ID (Google) — 소셜 로그인 인증

[선택 항목]
• 프로필 이미지 — 사용자 프로필 표시
• 관심종목 목록 — 관심종목 알림 및 홈화면 개인화
• 주BTI 투자 성향 (A/D/N/I) — 맞춤형 콘텐츠 추천

[자동 수집 항목]
• FCM 기기 토큰 — 푸시 알림 발송
• 접속 IP 주소 — 부정 이용 방지, 보안
• 쿠키 (세션 토큰) — 로그인 상태 유지
• 서비스 이용 행태 — Google Tag Manager를 통한 서비스 품질 개선

■ 제2조 (개인정보의 수집 및 이용 목적)

• 회원 관리: 회원 가입·탈퇴, 본인 확인, 계정 분쟁 조정
• 서비스 제공: 주식 정보 조회, 시장 데이터, 뉴스, 캘린더, 게시판 등
• 개인화 서비스: 관심종목 관리, 주BTI 성향 기반 콘텐츠 추천
• 푸시 알림: 일정 알림, 시황 브리핑, 서비스 공지 (FCM)
• 보안 및 부정 이용 방지: 로그인 이상 감지, 중복 가입 방지
• 광고 제공: Google AdSense, AliExpress 제휴 광고
• 마케팅: 이벤트·혜택 안내 (별도 동의 시에 한함)

■ 제3조 (개인정보의 보유 및 이용 기간)

• 회원 정보 — 회원 탈퇴 시까지
• FCM 기기 토큰 — 토큰 만료 또는 앱 삭제 시까지
• 로그인 실패 기록 — 15분
• Refresh Token — 발급 후 30일
• 전자상거래 관련 기록 — 5년 (전자상거래법)
• 접속 로그 — 3개월 (통신비밀보호법)

■ 제4조 (개인정보의 제3자 제공 및 처리 위탁)

[제3자 제공]
• Google LLC (미국): 소셜 로그인(OAuth), 광고(AdSense), 행동분석(GTM) — 이메일, 쿠키, 이용 행태

[처리 위탁]
• Google Firebase (FCM, 미국): 푸시 알림 발송
• Railway, Inc. (미국): 서버 및 DB 운영
• Resend (미국): 비밀번호 재설정 이메일 발송
• Google Gemini AI (미국): AI 뉴스 요약·분석 처리

※ 이용자의 개인정보는 위 목적 외에 제3자에게 제공되지 않습니다.

■ 제5조 (개인정보의 국외 이전)

• 이전 국가: 미국
• 이전받는 자: Google LLC, Railway, Inc., Resend, Inc.
• 이전 목적: OAuth 인증, AI, 광고, 푸시 알림, 서버 호스팅, 이메일 발송

■ 제6조 (쿠키 운영 및 거부)

서비스는 로그인 유지(NextAuth 세션), 광고 최적화(Google AdSense), 이용 분석(GTM) 목적으로 쿠키를 사용합니다.
브라우저 설정에서 쿠키를 차단할 수 있으나 일부 서비스 기능이 제한될 수 있습니다.

■ 제7조 (이용자의 권리 행사 방법)

• 개인정보 열람: 앱 내 설정 > 프로필
• 개인정보 수정: 앱 내 설정 > 프로필 수정
• 회원 탈퇴: 앱 내 설정 > 회원 탈퇴
• 기타 문의: support@jurini.co.kr

■ 제8조 (개인정보 보호 책임자)

• 책임자: 플로우 운영팀
• 이메일: support@jurini.co.kr
• 개인정보 침해 신고: 개인정보침해 신고센터 (privacy.kisa.or.kr / 118)"""

    return templates.TemplateResponse(
        "admin_terms_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "terms-privacy",
            "doc": doc,
            "title": "개인정보처리방침",
            "doc_type": "privacy",
        },
    )


@router.get("/admin/terms/service", response_class=HTMLResponse)
async def admin_terms_service_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """이용약관 편집 페이지"""
    if not user:
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, "terms")
    if not doc.content:
        doc.content = """플로우 이용약관

시행일: 2026년 3월 29일

■ 제1조 (목적)
이 약관은 플로우(이하 "회사" 또는 "서비스")가 제공하는 주식 정보 서비스의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.

■ 제2조 (정의)
1. "서비스"란 회사가 제공하는 플로우 웹앱, Android 모바일 앱 및 이와 관련된 제반 서비스를 의미합니다.
2. "이용자"란 이 약관에 동의하고 서비스를 이용하는 자를 의미합니다.
3. "회원"이란 회원가입을 완료하고 로그인하여 서비스를 이용하는 자를 의미합니다.
4. "AI 추천"이란 Gemini AI 또는 자체 알고리즘(일목균형표·종가베팅 스크리닝 등)이 생성한 결과물을 의미합니다.

■ 제3조 (약관의 게시 및 변경)
1. 본 약관은 서비스 내 설정 > 이용약관 화면에 게시합니다.
2. 약관 변경 시 시행 7일 전 앱 공지사항 또는 이메일로 고지합니다.

■ 제4조 (서비스 내용)
• 시장정보: 코스피/코스닥/해외 지수, 환율, 투자자 동향 (비회원 포함)
• 뉴스·시황: 네이버 뉴스, AI 요약, 증권사 리포트, 목표가 뉴스 (비회원 포함)
• 수급 정보: 기관/외국인 수급 현황, AI 수급 요약 (비회원 포함)
• 일정 캘린더: IPO, 배당, 실적발표 일정 (알림 구독은 회원 전용)
• 게시판·주톡: 커뮤니티, 대가의 한마디 (작성은 회원 전용)
• 주식용어사전: 500개 이상 용어 검색 (비회원 포함)
• 주BTI 테스트: 투자 성향 진단 (저장은 회원 전용)
• AI 추천 종목: 스크리닝 결과 (회원 전용, 비회원 일부 공개)
• 작가 픽: 운영자 추천 종목 모의 수익률 (회원 전용, 비회원 일부 공개)
• 푸시 알림: FCM 기반 일정·시황·공지 알림 (앱 설치 이용자)

■ 제5조 (회원가입)
1. 이용자는 이메일+비밀번호(최소 8자) 또는 Google 소셜 로그인으로 가입할 수 있습니다.
2. 만 14세 미만은 가입할 수 없습니다.
3. 타인 정보 도용, 허위 정보 기재 시 가입이 거부되거나 계정이 해지될 수 있습니다.

■ 제6조 (회원 등급)
1. 회원 등급: 일반(Regular), VIP, 패밀리(Family)
2. 등급에 따라 이용 가능한 서비스 범위가 다를 수 있습니다.
3. 유료 등급 기간 만료 시 자동으로 일반 등급으로 전환됩니다.

■ 제7조 (이용자의 금지 행위)
• 타인 개인정보 수집·공개
• 자동화 수집 도구(크롤러, 봇 등) 사용
• 허위 투자 정보 유포, 시세 조종 정보 게시
• 특정 종목에 대한 근거 없는 매수·매도 권유
• 음란·폭력·혐오 콘텐츠 게시
• 서비스 콘텐츠의 무단 상업적 이용

■ 제8조 (투자 정보 관련 면책) ★ 중요

본 서비스에서 제공하는 모든 주식 정보, AI 요약, 스크리닝 결과, 작가 픽, 수급 데이터, 뉴스 등은 정보 제공 목적에 한하며, 투자 권유 또는 투자 자문이 아닙니다.

회사는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업 또는 투자일임업을 영위하지 않습니다.

서비스 정보를 기반으로 한 투자 판단 및 결과에 대한 모든 책임은 이용자 본인에게 있습니다.

모의 매매(작가 픽 수익률)는 실제 투자 결과와 다를 수 있으며, 과거 수익률이 미래 수익률을 보장하지 않습니다.

■ 제9조 (지식재산권)
1. 서비스 내 회사가 제작한 콘텐츠의 저작권은 회사에 귀속됩니다.
2. 이용자가 작성한 게시글의 저작권은 해당 이용자에게 귀속되나, 서비스 운영 목적으로 활용될 수 있습니다.

■ 제10조 (광고 및 제휴)
• Google AdSense: 자동 맞춤 광고
• AliExpress 제휴 마케팅: 제휴 상품 노출 및 구매 연결 (수수료 수익)
• 증권사 MTS 연결: 연계 증권사 앱 링크 제공

■ 제11조 (준거법 및 분쟁 해결)
1. 본 약관은 대한민국 법령을 준거법으로 합니다.
2. 분쟁 발생 시 우선 support@jurini.co.kr을 통해 협의를 시도합니다.

문의처: support@jurini.co.kr"""

    return templates.TemplateResponse(
        "admin_terms_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "terms-service",
            "doc": doc,
            "title": "이용약관",
            "doc_type": "terms",
        },
    )


@router.get("/admin/terms/about", response_class=HTMLResponse)
async def admin_terms_about_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """플로우 앱 소개 편집 페이지"""
    if not user:
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, "about")
    if not doc.content:
        doc.content = """플로우 - 투자자를 위한 주식 정보 앱

플로우는 주식 투자를 처음 시작하는 분들을 위한 쉽고 친절한 주식 정보 앱입니다.

주요 기능
- 오늘의 시장: 실시간 국내/해외 지수, 환율 정보를 한눈에 확인
- 일정 캘린더: 실적 발표, 공모 청약, 배당일 등 주요 일정 알림
- 주식 용어 사전: 어려운 주식 용어를 쉽게 풀어서 설명
- 커뮤니티: 플로우 사용자끼리 정보 공유 및 질문

문의
- 이메일: support@jurini.co.kr"""

    return templates.TemplateResponse(
        "admin_terms_html_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "active_page": "terms-about",
            "doc": doc,
            "title": "플로우 앱",
            "doc_type": "about",
        },
    )


REDIRECT_MAP = {
    "privacy": "/admin/terms/privacy",
    "terms": "/admin/terms/service",
    "about": "/admin/terms/about",
}


@router.post("/admin/terms/{doc_type}/save")
async def save_terms(
    doc_type: str,
    content: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """콘텐츠 저장"""
    if not user or doc_type not in DOC_TYPES:
        return RedirectResponse(url="/")
    doc = get_or_create_document(db, doc_type)
    doc.content = content.strip()
    db.commit()
    redirect_url = REDIRECT_MAP.get(doc_type, "/admin/terms/privacy")
    return RedirectResponse(url=redirect_url, status_code=303)


# ==================== FE API ====================

@router.get("/api/legal-documents/{doc_type}")
async def api_get_legal_document(
    doc_type: str,
    _=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    """법적 문서 조회 (개인정보처리방침, 이용약관, 앱 소개) - FE용"""
    if doc_type not in DOC_TYPES:
        return {"success": False, "content": None}
    doc = db.query(models.LegalDocument).filter(models.LegalDocument.doc_type == doc_type).first()
    content = doc.content if doc else None
    return {"success": True, "content": content}
