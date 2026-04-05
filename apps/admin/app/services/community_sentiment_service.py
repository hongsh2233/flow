"""
투자 커뮤니티 게시글 수집 서비스

네이버 금융 시장토론 + DC인사이드 주식갤러리에서 게시글 제목을 수집하여
CommunityPost 테이블에 저장한다.
"""
import re
from datetime import datetime, timedelta
from typing import List, Dict

import httpx
import pytz
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.engine.models import CommunityPost

_KST = pytz.timezone("Asia/Seoul")

_HEADERS_NAVER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

_HEADERS_DC = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://gall.dcinside.com/board/lists/?id=stock_new",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
}

_TIMEOUT = 20.0


# ─────────────────────────────────────────────
# 네이버 금융 시장토론
# ─────────────────────────────────────────────

async def fetch_naver_forum_posts(pages: int = 3) -> List[Dict]:
    """네이버 금융 시장토론 게시글 제목 수집"""
    posts: List[Dict] = []
    base_url = "https://finance.naver.com/forum/boardlist.naver"

    async with httpx.AsyncClient(headers=_HEADERS_NAVER, timeout=_TIMEOUT, follow_redirects=True) as client:
        for page in range(1, pages + 1):
            try:
                resp = await client.get(base_url, params={"id": "stock_gen", "page": page})
                resp.raise_for_status()
                html = resp.content.decode("euc-kr", errors="replace")
                soup = BeautifulSoup(html, "html.parser")

                # 게시판 테이블의 각 행 파싱
                rows = soup.select("table.type_1 tr")
                for row in rows:
                    tds = row.find_all("td")
                    if len(tds) < 5:
                        continue
                    # 제목
                    title_tag = tds[0].find("a")
                    if not title_tag:
                        continue
                    title = title_tag.get_text(strip=True)
                    if not title:
                        continue
                    # post_id from href
                    href = title_tag.get("href", "")
                    pid_match = re.search(r"no=(\d+)", href)
                    post_id = pid_match.group(1) if pid_match else ""
                    if not post_id:
                        continue
                    # 조회수
                    view_text = tds[3].get_text(strip=True).replace(",", "") if len(tds) > 3 else "0"
                    view_count = int(view_text) if view_text.isdigit() else 0
                    # 추천수
                    like_text = tds[4].get_text(strip=True).replace(",", "") if len(tds) > 4 else "0"
                    like_count = int(like_text) if like_text.isdigit() else 0

                    posts.append({
                        "post_id": post_id,
                        "title": title[:500],
                        "view_count": view_count,
                        "like_count": like_count,
                    })
            except Exception as e:
                print(f"[커뮤니티] 네이버 시장토론 page={page} 오류: {e}")
                continue

    return posts


# ─────────────────────────────────────────────
# DC인사이드 주식갤러리
# ─────────────────────────────────────────────

async def fetch_dcinside_stock_posts(pages: int = 3) -> List[Dict]:
    """DC인사이드 주식갤러리 게시글 제목 수집"""
    posts: List[Dict] = []
    base_url = "https://gall.dcinside.com/board/lists/"

    async with httpx.AsyncClient(headers=_HEADERS_DC, timeout=_TIMEOUT, follow_redirects=True) as client:
        for page in range(1, pages + 1):
            try:
                resp = await client.get(base_url, params={"id": "stock_new", "page": page})
                resp.raise_for_status()
                html = resp.text
                soup = BeautifulSoup(html, "html.parser")

                rows = soup.select("tr.ub-content")
                for row in rows:
                    # 공지/AD 제외
                    num_td = row.select_one("td.gall_num")
                    if num_td:
                        num_text = num_td.get_text(strip=True)
                        if num_text in ("공지", "설문", "AD"):
                            continue

                    title_tag = row.select_one("td.gall_tit a")
                    if not title_tag:
                        continue
                    title = title_tag.get_text(strip=True)
                    if not title:
                        continue

                    # post_id from href
                    href = title_tag.get("href", "")
                    pid_match = re.search(r"no=(\d+)", href)
                    post_id = pid_match.group(1) if pid_match else ""
                    if not post_id:
                        continue

                    # 조회수
                    view_td = row.select_one("td.gall_count")
                    view_text = view_td.get_text(strip=True).replace(",", "") if view_td else "0"
                    view_count = int(view_text) if view_text.isdigit() else 0

                    # 추천수
                    rec_td = row.select_one("td.gall_recommend")
                    rec_text = rec_td.get_text(strip=True).replace(",", "") if rec_td else "0"
                    like_count = int(rec_text) if rec_text.isdigit() else 0

                    posts.append({
                        "post_id": post_id,
                        "title": title[:500],
                        "view_count": view_count,
                        "like_count": like_count,
                    })
            except Exception as e:
                print(f"[커뮤니티] DC 주식갤러리 page={page} 오류: {e}")
                continue

    return posts


# ─────────────────────────────────────────────
# 수집 + DB 저장
# ─────────────────────────────────────────────

async def collect_community_posts(db: Session) -> dict:
    """
    커뮤니티 게시글 수집 + DB upsert.
    반환: {"naver": N, "dc": N}
    """
    now = datetime.now(_KST)
    today_str = now.strftime("%Y-%m-%d")

    naver_posts = await fetch_naver_forum_posts(pages=3)
    dc_posts = await fetch_dcinside_stock_posts(pages=3)

    saved = {"naver": 0, "dc": 0}

    for source, posts in [("naver_forum", naver_posts), ("dcinside", dc_posts)]:
        for p in posts:
            stmt = pg_insert(CommunityPost).values(
                source=source,
                post_id=p["post_id"],
                title=p["title"],
                view_count=p["view_count"],
                like_count=p["like_count"],
                collected_at=now,
                collected_date=today_str,
            ).on_conflict_do_update(
                constraint="uq_community_post",
                set_={
                    "title": p["title"],
                    "view_count": p["view_count"],
                    "like_count": p["like_count"],
                    "collected_at": now,
                    "collected_date": today_str,
                },
            )
            db.execute(stmt)
        db.commit()
        key = "naver" if source == "naver_forum" else "dc"
        saved[key] = len(posts)

    # 7일 이전 데이터 정리
    cleanup_old_community_posts(db, days=7)

    return saved


def cleanup_old_community_posts(db: Session, days: int = 7):
    """오래된 커뮤니티 게시글 삭제"""
    cutoff = (datetime.now(_KST) - timedelta(days=days)).strftime("%Y-%m-%d")
    db.query(CommunityPost).filter(CommunityPost.collected_date < cutoff).delete()
    db.commit()
