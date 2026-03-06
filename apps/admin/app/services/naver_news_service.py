"""
네이버 뉴스 API를 활용한 주가 직접 영향 뉴스 수집 서비스

수주, 실적발표, 배당, 연구개발, 기술이전, 유상증자 등
주가에 직접적인 영향을 미치는 뉴스를 키워드 기반으로 검색합니다.

사전 준비:
    환경 변수에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 설정 필요
    (네이버 개발자 센터 https://developers.naver.com 에서 애플리케이션 등록 후 발급)
"""
import re
import httpx
from typing import List, Dict, Optional
from datetime import datetime
from email.utils import parsedate_to_datetime
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
import pytz

from app.config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
from app.models import NaverStockNews


# ----------------------------------------------------------------
# 주가에 직접 영향을 미치는 키워드 카테고리 정의
# ----------------------------------------------------------------
STOCK_IMPACT_KEYWORDS: Dict[str, List[str]] = {
    "수주":       ["수주", "계약 체결", "수주 계약", "대규모 계약", "공급 계약"],
    "실적발표":   ["실적 발표", "영업이익", "순이익", "매출액 증가", "어닝 서프라이즈", "실적 개선", "흑자 전환"],
    "배당":       ["배당 발표", "배당금", "특별 배당", "배당 확대", "배당 결정"],
    "연구개발":   ["연구개발", "R&D", "신약 개발", "신기술 개발", "파이프라인"],
    "기술이전":   ["기술이전", "기술 수출", "라이선스 계약", "기술료"],
    "유상증자":   ["유상증자", "주주배정 유상증자", "제3자배정 유상증자", "증자 결정"],
    "무상증자":   ["무상증자"],
    "자사주매입": ["자사주 매입", "자기주식 취득", "자사주 취득"],
    "합병인수":   ["합병", "인수합병", "M&A", "피인수", "기업 인수"],
    "특허":       ["특허 등록", "특허 획득", "특허권"],
    "임상":       ["임상 성공", "임상 통과", "FDA 승인", "품목 허가", "임상시험 결과"],
    "적자전환":   ["적자 전환", "영업손실", "순손실", "어닝 쇼크", "실적 악화"],
    "상장":       ["코스피 상장", "코스닥 상장", "IPO", "상장 예정", "상장 철회"],
    "분할":       ["인적분할", "물적분할", "기업 분할"],
}

NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
# 카테고리당 최대 수집 건수 (네이버 API 최대 100건)
MAX_DISPLAY_PER_KEYWORD = 20
# 보관 일수
KEEP_DAYS = 7


def _strip_html(text: str) -> str:
    """HTML 태그 및 엔티티 제거"""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">") \
               .replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _parse_pub_datetime(pub_date_str: str) -> Optional[datetime]:
    """RFC 2822 형식의 날짜 문자열을 datetime으로 변환"""
    if not pub_date_str:
        return None
    try:
        dt = parsedate_to_datetime(pub_date_str)
        return dt.astimezone(pytz.utc)
    except Exception:
        return None


class NaverNewsService:
    """
    네이버 뉴스 검색 API를 이용해 주가 영향 뉴스를 수집하는 서비스.

    사용 예시::

        service = NaverNewsService()
        news_list = await service.fetch_stock_impact_news()
    """

    def __init__(self):
        self.client_id = NAVER_CLIENT_ID
        self.client_secret = NAVER_CLIENT_SECRET
        self.timeout = 10.0

    def _is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _headers(self) -> Dict[str, str]:
        return {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret,
        }

    async def _search_news(
        self,
        keyword: str,
        display: int = MAX_DISPLAY_PER_KEYWORD,
        sort: str = "date",
    ) -> List[Dict]:
        """
        단일 키워드로 네이버 뉴스 검색

        Args:
            keyword: 검색 키워드
            display: 결과 수 (최대 100)
            sort: 'date' (최신순) | 'sim' (관련도순)

        Returns:
            List[Dict]: 뉴스 아이템 리스트 (title, description, link, pubDate)
        """
        params = {
            "query": keyword,
            "display": min(display, 100),
            "start": 1,
            "sort": sort,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                NAVER_NEWS_API_URL,
                params=params,
                headers=self._headers(),
            )
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])

    async def fetch_stock_impact_news(
        self,
        categories: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        주가 직접 영향 뉴스 수집

        Args:
            categories: 특정 카테고리만 조회할 때 지정 (None이면 전체)
                예: ['수주', '실적발표', '배당']

        Returns:
            List[Dict]: 카테고리·키워드 태그가 붙은 뉴스 리스트
        """
        if not self._is_configured():
            print("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.")
            return []

        target_categories = (
            {k: v for k, v in STOCK_IMPACT_KEYWORDS.items() if k in categories}
            if categories
            else STOCK_IMPACT_KEYWORDS
        )

        results: List[Dict] = []
        seen_links: set = set()

        for category, keywords in target_categories.items():
            for keyword in keywords:
                try:
                    items = await self._search_news(keyword)
                    for item in items:
                        link = item.get("link", "")
                        if not link or link in seen_links:
                            continue
                        seen_links.add(link)
                        results.append({
                            "category": category,
                            "keyword": keyword,
                            "title": _strip_html(item.get("title", "")),
                            "description": _strip_html(item.get("description", "")),
                            "link": link,
                            "pub_date": item.get("pubDate", ""),
                            "pub_datetime": _parse_pub_datetime(item.get("pubDate", "")),
                        })
                except httpx.HTTPStatusError as e:
                    print(f"네이버 API 오류 (키워드: {keyword}): {e.response.status_code}")
                except Exception as e:
                    print(f"뉴스 수집 오류 (키워드: {keyword}): {e}")

        print(f"주가 영향 뉴스 수집 완료: {len(results)}건 (중복 제거 후)")
        return results

    def save_news_to_db(self, db: Session, news_list: List[Dict]) -> int:
        """
        수집된 뉴스를 DB에 저장 (link 기준 중복 무시)

        Args:
            db: SQLAlchemy 세션
            news_list: fetch_stock_impact_news() 반환값

        Returns:
            int: 새로 저장된 건수
        """
        if not news_list:
            return 0

        kst = pytz.timezone("Asia/Seoul")
        collected_at = datetime.now(kst)
        saved = 0

        for item in news_list:
            try:
                existing = db.query(NaverStockNews).filter(
                    NaverStockNews.link == item["link"]
                ).first()
                if existing:
                    continue

                new_news = NaverStockNews(
                    category=item["category"],
                    keyword=item["keyword"],
                    title=item["title"],
                    description=item.get("description"),
                    link=item["link"],
                    pub_date=item.get("pub_date"),
                    pub_datetime=item.get("pub_datetime"),
                    collected_at=collected_at,
                )
                db.add(new_news)
                saved += 1
            except Exception as e:
                print(f"뉴스 저장 오류 (link={item.get('link', '')[:60]}): {e}")
                continue

        try:
            db.commit()
            print(f"뉴스 DB 저장 완료: {saved}건 (신규)")
        except Exception as e:
            db.rollback()
            print(f"뉴스 DB 커밋 오류: {e}")
            raise

        return saved

    def cleanup_old_news(self, db: Session, keep_days: int = KEEP_DAYS) -> int:
        """
        오래된 뉴스 삭제 (최근 N일치만 유지)

        Args:
            db: SQLAlchemy 세션
            keep_days: 유지할 일수

        Returns:
            int: 삭제된 건수
        """
        from datetime import timedelta
        kst = pytz.timezone("Asia/Seoul")
        cutoff = datetime.now(kst) - timedelta(days=keep_days)
        try:
            deleted = db.query(NaverStockNews).filter(
                NaverStockNews.collected_at < cutoff
            ).delete()
            db.commit()
            if deleted > 0:
                print(f"오래된 뉴스 {deleted}건 삭제 완료 (기준: {keep_days}일 이전)")
            return deleted
        except Exception as e:
            db.rollback()
            print(f"오래된 뉴스 삭제 오류: {e}")
            return 0

    def get_news_by_category(
        self,
        db: Session,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict]:
        """
        카테고리별 뉴스 조회 (DB)

        Args:
            db: SQLAlchemy 세션
            category: 카테고리 필터 (None이면 전체)
            limit: 최대 반환 건수
            offset: 페이지 오프셋

        Returns:
            List[Dict]: 뉴스 리스트
        """
        query = db.query(NaverStockNews).order_by(
            NaverStockNews.pub_datetime.desc().nullslast(),
            NaverStockNews.collected_at.desc(),
        )
        if category:
            query = query.filter(NaverStockNews.category == category)

        items = query.offset(offset).limit(limit).all()
        return [
            {
                "id": n.id,
                "category": n.category,
                "keyword": n.keyword,
                "title": n.title,
                "description": n.description,
                "link": n.link,
                "pub_date": n.pub_date,
                "pub_datetime": n.pub_datetime.isoformat() if n.pub_datetime else None,
                "collected_at": n.collected_at.isoformat() if n.collected_at else None,
            }
            for n in items
        ]


# 전역 서비스 인스턴스
naver_news_service = NaverNewsService()
