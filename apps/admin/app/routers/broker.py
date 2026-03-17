"""
증권사 설정 라우터
- 대한민국 주요 증권사 리스트 및 MTS/모바일웹 링크 관리
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


# 대한민국 주요 증권사 데이터
# android_intent: 앱이 설치된 경우 바로 실행 (intent:// scheme)
# android_store: Play Store URL (설치 유도 또는 실행)
# ios_store: App Store URL
# mobile_web: 모바일 웹 URL (앱 없을 때 fallback)
BROKERS = [
    {
        "id": "samsung",
        "name": "삼성증권",
        "short": "삼성",
        "logo_color": "#1428A0",
        "android_package": "com.samsungpop.mfacesandroid",
        "android_store": "https://play.google.com/store/apps/details?id=com.samsungpop.mfacesandroid",
        "ios_store": "https://apps.apple.com/kr/app/id375588941",
        "mobile_web": "https://m.samsungpop.com",
        "deep_link": "samsungpop://",
    },
    {
        "id": "mirae",
        "name": "미래에셋증권",
        "short": "미래에셋",
        "logo_color": "#E8001F",
        "android_package": "com.miraeasset.brokerage",
        "android_store": "https://play.google.com/store/apps/details?id=com.miraeasset.brokerage",
        "ios_store": "https://apps.apple.com/kr/app/id469553772",
        "mobile_web": "https://securities.miraeasset.com/hkd/hkd8000/h/hkd8000h.do",
        "deep_link": "miraeasset://",
    },
    {
        "id": "korea_invest",
        "name": "한국투자증권",
        "short": "한국투자",
        "logo_color": "#FF6600",
        "android_package": "com.truefriend.mobiletradingpad",
        "android_store": "https://play.google.com/store/apps/details?id=com.truefriend.mobiletradingpad",
        "ios_store": "https://apps.apple.com/kr/app/id394679049",
        "mobile_web": "https://m.truefriend.com",
        "deep_link": "truefriend://",
    },
    {
        "id": "nh",
        "name": "NH투자증권",
        "short": "NH투자",
        "logo_color": "#009B3A",
        "android_package": "com.nhqv.SmartmAllApp",
        "android_store": "https://play.google.com/store/apps/details?id=com.nhqv.SmartmAllApp",
        "ios_store": "https://apps.apple.com/kr/app/id409753557",
        "mobile_web": "https://m.nhqv.com",
        "deep_link": "nhqv://",
    },
    {
        "id": "kb",
        "name": "KB증권",
        "short": "KB",
        "logo_color": "#FFB800",
        "android_package": "com.kbfg.kbsmart",
        "android_store": "https://play.google.com/store/apps/details?id=com.kbfg.kbsmart",
        "ios_store": "https://apps.apple.com/kr/app/id1140959266",
        "mobile_web": "https://m.kbsec.com",
        "deep_link": "kbsmart://",
    },
    {
        "id": "shinhan",
        "name": "신한투자증권",
        "short": "신한",
        "logo_color": "#0046FF",
        "android_package": "com.shinhaninvest.android8",
        "android_store": "https://play.google.com/store/apps/details?id=com.shinhaninvest.android8",
        "ios_store": "https://apps.apple.com/kr/app/id441741268",
        "mobile_web": "https://m.shinhaninvest.com",
        "deep_link": "shinhaninvest://",
    },
    {
        "id": "kiwoom",
        "name": "키움증권",
        "short": "키움",
        "logo_color": "#FF0000",
        "android_package": "com.kiwoom.hero",
        "android_store": "https://play.google.com/store/apps/details?id=com.kiwoom.hero",
        "ios_store": "https://apps.apple.com/kr/app/id430441714",
        "mobile_web": "https://m.kiwoom.com",
        "deep_link": "kiwoom://",
    },
    {
        "id": "daishin",
        "name": "대신증권",
        "short": "대신",
        "logo_color": "#004098",
        "android_package": "com.daishin.cybosplus.lite",
        "android_store": "https://play.google.com/store/apps/details?id=com.daishin.cybosplus.lite",
        "ios_store": "https://apps.apple.com/kr/app/id535782754",
        "mobile_web": "https://m.daishin.com",
        "deep_link": "daishin://",
    },
    {
        "id": "meritz",
        "name": "메리츠증권",
        "short": "메리츠",
        "logo_color": "#E8001F",
        "android_package": "com.meritz.mstock",
        "android_store": "https://play.google.com/store/apps/details?id=com.meritz.mstock",
        "ios_store": "https://apps.apple.com/kr/app/id1450462249",
        "mobile_web": "https://m.meritz.co.kr",
        "deep_link": "meritz://",
    },
    {
        "id": "hana",
        "name": "하나증권",
        "short": "하나",
        "logo_color": "#009999",
        "android_package": "com.hanabank.hanas",
        "android_store": "https://play.google.com/store/apps/details?id=com.hanabank.hanas",
        "ios_store": "https://apps.apple.com/kr/app/id489574978",
        "mobile_web": "https://m.hanasec.co.kr",
        "deep_link": "hanas://",
    },
    {
        "id": "ebest",
        "name": "이베스트투자증권",
        "short": "이베스트",
        "logo_color": "#0066CC",
        "android_package": "com.ebest.efriend.neo",
        "android_store": "https://play.google.com/store/apps/details?id=com.ebest.efriend.neo",
        "ios_store": "https://apps.apple.com/kr/app/id573573965",
        "mobile_web": "https://m.ebest.co.kr",
        "deep_link": "efriend://",
    },
    {
        "id": "toss",
        "name": "토스증권",
        "short": "토스",
        "logo_color": "#0064FF",
        "android_package": "viva.republica.toss",
        "android_store": "https://play.google.com/store/apps/details?id=viva.republica.toss",
        "ios_store": "https://apps.apple.com/kr/app/id839333328",
        "mobile_web": "https://securities.toss.im",
        "deep_link": "supertoss://",
    },
    {
        "id": "kakao",
        "name": "카카오페이증권",
        "short": "카카오페이",
        "logo_color": "#3A1D1D",
        "android_package": "com.kakaopaycorp.stock",
        "android_store": "https://play.google.com/store/apps/details?id=com.kakaopaycorp.stock",
        "ios_store": "https://apps.apple.com/kr/app/id1454341791",
        "mobile_web": "https://securities.kakaopay.com",
        "deep_link": "kakaopay://",
    },
    {
        "id": "yuanta",
        "name": "유안타증권",
        "short": "유안타",
        "logo_color": "#CC0000",
        "android_package": "com.yuanta.mobile.android.mts",
        "android_store": "https://play.google.com/store/apps/details?id=com.yuanta.mobile.android.mts",
        "ios_store": "https://apps.apple.com/kr/app/id671956654",
        "mobile_web": "https://m.yuanta.co.kr",
        "deep_link": "yuanta://",
    },
    {
        "id": "hyundai",
        "name": "현대차증권",
        "short": "현대차",
        "logo_color": "#002C5F",
        "android_package": "com.hmcib.smartmts",
        "android_store": "https://play.google.com/store/apps/details?id=com.hmcib.smartmts",
        "ios_store": "https://apps.apple.com/kr/app/id491179635",
        "mobile_web": "https://m.hmcib.com",
        "deep_link": "hmcib://",
    },
]


@router.get("/admin/broker-settings", response_class=HTMLResponse)
async def broker_settings_page(
    request: Request,
    user=Depends(get_current_user),
):
    """증권사 설정 페이지"""
    from fastapi.responses import RedirectResponse
    if not user:
        return RedirectResponse(url="/")

    return templates.TemplateResponse("broker_settings.html", {
        "request": request,
        "admin_email": user.email,
        "brokers": BROKERS,
        "active_page": "broker-settings",
    })


@router.get("/api/brokers")
async def get_brokers():
    """증권사 목록 API (프론트엔드용)"""
    return {"brokers": BROKERS}
