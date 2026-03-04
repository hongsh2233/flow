"""
데이터베이스 모델 정의 (PostgreSQL 호환)
"""
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, ForeignKey, UniqueConstraint, Float, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.engine.database import Base

class NavMenuItem(Base):
    """웹 앱 하단/헤더 메뉴 항목 (설정 페이지에서 관리)"""
    __tablename__ = "nav_menu_items"
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(50), nullable=False)
    icon = Column(String(50), nullable=False, default="icon_home")
    link_type = Column(String(20), nullable=False, default="page")  # 'page' | 'board'
    link_value = Column(String(255), nullable=False)  # path (e.g. /news) or board_id (e.g. B001)
    match_paths = Column(String(500), nullable=True)  # comma-separated paths for active state
    order_index = Column(Integer, nullable=False, default=0)
    is_visible = Column(String(20), default="visible")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    tabs = relationship("NavMenuTab", back_populates="nav_menu_item", order_by="NavMenuTab.order_index", cascade="all, delete-orphan")


class NavMenuTab(Base):
    """메뉴별 서브 메뉴/탭 (하위 탭 설정)"""
    __tablename__ = "nav_menu_tabs"
    id = Column(Integer, primary_key=True, index=True)
    nav_menu_item_id = Column(Integer, ForeignKey("nav_menu_items.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(50), nullable=False)
    link_type = Column(String(20), nullable=False, default="page")  # 'page' | 'board'
    link_value = Column(String(255), nullable=False)  # path (e.g. /news, /report) or board_id (e.g. B001)
    order_index = Column(Integer, nullable=False, default=0)
    is_visible = Column(String(20), default="visible")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    nav_menu_item = relationship("NavMenuItem", back_populates="tabs")


__all__ = [
    "Base",
    "ExchangeRateSnapshot",
    "CollectedData",
    "AdminUser",
    "Schedule",
    "Board",
    "BoardCategory",
    "Post",
    "KrxData",
    "FscStockPrice",
    "FscRisingStock",
    "RefreshToken",
    "Member",
    "Character",
    "StockWord",
    "MainPageItem",
    "Banner",
    "Popup",
    "Notification",
    "NotificationRead",
    "ScheduleAlarmSubscription",
    "MemberFcmToken",
    "NavMenuItem",
    "NavMenuTab",
    "NaverStockRanking",
    "YahooIndexSnapshot",
    "YahooIndexDaily",
    "StockTerm",
    "FaqCategory",
    "FaqItem",
    "LegalDocument",
  "MasterQuote",
]


class CollectedData(Base):
    __tablename__ = "collected_data"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50))
    status = Column(String(20))
    message = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    name = Column(String(50))
    hashed_password = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Member(Base):
    __tablename__ = "members"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    name = Column(String(50), nullable=False)
    nickname = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=True)  # 일반 로그인용 비밀번호 (소셜 로그인 시 NULL)
    profile_image = Column(String(500), nullable=True)
    provider = Column(String(20), nullable=False, index=True)
    provider_id = Column(String(255), nullable=True, index=True)  # 일반 로그인 시 NULL 허용
    status = Column(String(20), default="active")
    grade = Column(String(20), nullable=False, default="regular")  # 'regular' | 'vip' | 'family'
    grade_expires_at = Column(DateTime(timezone=True), nullable=True)  # NULL = 무기한
    favorite_stocks = Column(Text, nullable=True)
    jubti_type = Column(String(10), nullable=True)  # 주BTI 성향: A | D | N | I
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True))


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=True)  # 기간 일정의 종료일 (NULL이면 단일 날짜)
    scheduled_time = Column(String(5), nullable=True)  # HH:mm (선택)
    subject = Column(String(255), nullable=False)
    content = Column(String(500))  # 요약 내용
    detail = Column(Text)  # 상세 내용
    type = Column(String(20), default="manual")
    link_url = Column(String(500), nullable=True)   # DART/증권사 등 링크 (새 창)
    underwriter = Column(String(200), nullable=True)  # 주관 증권사 (공모청약 등)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Board(Base):
    __tablename__ = "boards"
    id = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)
    auth = Column(String(20), nullable=False, default="all")
    use_categories = Column(String(20), default="false")  # 카테고리 사용 여부
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    posts = relationship("Post", back_populates="board", cascade="all, delete-orphan")
    categories = relationship("BoardCategory", back_populates="board", cascade="all, delete-orphan", order_by="BoardCategory.order_index")


class BoardCategory(Base):
    """게시판별 카테고리 (Admin에서 생성, 설정에서 사용여부 체크)"""
    __tablename__ = "board_categories"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(String(20), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    board = relationship("Board", back_populates="categories")
    posts = relationship("Post", back_populates="category")


class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(String(20), ForeignKey("boards.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("board_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(100))
    views = Column(Integer, default=0)
    is_secret = Column(String(20), default="false")
    is_member_only = Column(String(20), default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    board = relationship("Board", back_populates="posts")
    category = relationship("BoardCategory", back_populates="posts")


class KrxData(Base):
    __tablename__ = "krx_data"
    id = Column(Integer, primary_key=True, index=True)
    data_type = Column(String(20), nullable=False, index=True)
    bas_dd = Column(String(8), nullable=False, index=True)
    data = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint('data_type', 'bas_dd', name='uq_krx_data_type_date'),)


class FscStockPrice(Base):
    __tablename__ = "fsc_stock_price"
    id = Column(Integer, primary_key=True, index=True)
    bas_dt = Column(String(8), nullable=False, index=True)
    srtn_cd = Column(String(10), nullable=False)
    isin_cd = Column(String(12))
    itms_nm = Column(String(100))
    mrkt_ctg = Column(String(20))
    clpr = Column(String(20))
    vs = Column(String(20))
    flt_rt = Column(String(20))
    mkp = Column(String(20))
    hipr = Column(String(20))
    lopr = Column(String(20))
    trqu = Column(String(20))
    tr_prc = Column(String(20))
    lstg_st_cnt = Column(String(20))
    mrkt_tot_amt = Column(String(30))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint('bas_dt', 'srtn_cd', name='uq_fsc_stock_price_date_code'),)


class FscRisingStock(Base):
    __tablename__ = "fsc_rising_stock"
    id = Column(Integer, primary_key=True, index=True)
    bas_dt = Column(String(8), nullable=False, index=True)
    srtn_cd = Column(String(10), nullable=False)
    isin_cd = Column(String(12))
    itms_nm = Column(String(100))
    mrkt_ctg = Column(String(20))
    clpr = Column(String(20))
    vs = Column(String(20))
    flt_rt = Column(String(20))
    mkp = Column(String(20))
    hipr = Column(String(20))
    lopr = Column(String(20))
    trqu = Column(String(20))
    tr_prc = Column(String(20))
    lstg_st_cnt = Column(String(20))
    mrkt_tot_amt = Column(String(30))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint('bas_dt', 'srtn_cd', name='uq_fsc_rising_stock_date_code'),)


class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    image_url = Column(String(500), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    is_active = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StockWord(Base):
    __tablename__ = "stock_words"
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(50), nullable=False, unique=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_active = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MainPageItem(Base):
    __tablename__ = "main_page_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    component_key = Column(String(50), nullable=False, unique=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_visible = Column(String(20), default="visible")
    start_date = Column(String(16), nullable=True)
    end_date = Column(String(16), nullable=True)
    repeat_type = Column(String(20), default="none")
    repeat_days = Column(String(20), nullable=True)
    repeat_start_time = Column(String(5), nullable=True)
    repeat_end_time = Column(String(5), nullable=True)
    repeat_next_day = Column(String(5), default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Banner(Base):
    __tablename__ = "banners"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False, index=True)
    image_url = Column(String(500), nullable=True)  # content_type=html일 때 null 허용
    link_url = Column(String(500), nullable=True)
    alt_text = Column(String(200), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_active = Column(String(20), default="active")
    # 배너형태: single(1개형), slide(슬라이드형)
    display_type = Column(String(20), default="single")
    # 콘텐츠형태: image(이미지), html(HTML)
    content_type = Column(String(20), default="image")
    # HTML 배너일 때 내용
    html_content = Column(String(5000), nullable=True)
    # 노출 페이지 경로 (JSON 배열 문자열, 예: '["/","/stocks"]')
    page_paths = Column(String(500), nullable=True)
    # 슬라이드형일 때 같은 그룹끼리 묶음
    slide_group = Column(String(50), nullable=True)
    # 노출 위치: top(페이지 상단), bottom(페이지 하단)
    position = Column(String(20), default="top")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Notification(Base):
    """앱 내 알림 (새 게시글, 공지 등)"""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(30), nullable=False, default="new_post")  # 'new_post' | 'notice' | 'system'
    title = Column(String(255), nullable=False)
    message = Column(String(500), nullable=True)
    link_url = Column(String(500), nullable=True)
    is_global = Column(String(10), nullable=False, default="true")  # 모든 회원 대상
    target_email = Column(String(100), nullable=True, index=True)  # 개인 알림 대상 (is_global="false" 시 사용)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NotificationRead(Base):
    """회원별 알림 읽음 기록"""
    __tablename__ = "notification_reads"
    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, index=True)
    member_email = Column(String(100), nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('notification_id', 'member_email', name='uq_notification_read'),)


class ScheduleAlarmSubscription(Base):
    """회원별 일정 알림 신청 내역"""
    __tablename__ = "schedule_alarm_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    member_email = Column(String(100), nullable=False, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    # "1min" | "30min" | "1day" | "2day"
    timing = Column(String(10), nullable=False, default="1day")
    # 알림 발송 여부
    notified = Column(String(10), nullable=False, default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('member_email', 'schedule_id', name='uq_schedule_alarm_sub'),)


class MemberFcmToken(Base):
    """회원 FCM 푸시 토큰 (Capacitor APK용)"""
    __tablename__ = "member_fcm_tokens"
    id = Column(Integer, primary_key=True, index=True)
    member_email = Column(String(100), nullable=False, index=True)
    token = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint('member_email', 'token', name='uq_member_fcm_token'),)


class Popup(Base):
    """메인 페이지 팝업 (모달)"""
    __tablename__ = "popups"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content_type = Column(String(20), nullable=False, default="html")  # 'html' | 'image'
    html_content = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    link_url = Column(String(500), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    is_active = Column(String(20), default="active")  # 'active' | 'inactive'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NaverStockRanking(Base):
    __tablename__ = "naver_stock_ranking"
    id = Column(Integer, primary_key=True, index=True)
    ranking_type = Column(String(20), nullable=False, index=True)
    market_type = Column(String(20), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    stock_code = Column(String(10), nullable=False, index=True)
    stock_name = Column(String(100), nullable=False)
    current_price = Column(String(20))
    change = Column(String(20))
    change_percent = Column(String(20))
    volume = Column(String(30))
    amount = Column(String(30))
    collected_at = Column(DateTime(timezone=True), nullable=False, index=True)
    collected_time = Column(String(5), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('ranking_type', 'market_type', 'rank', 'collected_at', name='uq_naver_ranking'),)


class NaverSupplyData(Base):
    """
    네이버 수급 동향 데이터
    - 투자자별 매매동향 (시간별 / 일자별)
    - 수급 순위 (외인/기관 순매수/매도)
    - 프로그램 매매 (시간별 / 일자별)
    data_type 값:
        'investor_time'  : 투자자별 매매동향 시간별
        'investor_day'   : 투자자별 매매동향 일자별
        'deal_rank'      : 수급 순위 (market/investor_type/trade_type 조합)
        'program_time'   : 프로그램매매 시간별
        'program_day'    : 프로그램매매 일자별
    """
    __tablename__ = "naver_supply_data"
    id = Column(Integer, primary_key=True, index=True)
    data_type = Column(String(30), nullable=False, index=True)
    # 'kospi'|'kosdaq'|'all'  (deal_rank은 'kospi'/'kosdaq')
    market = Column(String(20), nullable=False, default='all', index=True)
    # deal_rank용 추가 구분: e.g. 'foreign_buy', 'foreign_sell', 'inst_buy', 'inst_sell'
    sub_key = Column(String(30), nullable=True, index=True)
    # 헤더+행 파싱 결과 JSON: {"headers": [...], "rows": [[...]]}
    data_json = Column(Text, nullable=True)
    bizdate = Column(String(8), nullable=False, index=True)   # YYYYMMDD (당일)
    collected_time = Column(String(5), nullable=False, index=True)  # 'HH:MM'
    collected_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint('data_type', 'market', 'sub_key', 'bizdate', 'collected_time',
                         name='uq_naver_supply_data'),
    )


class YahooIndexSnapshot(Base):
    """
    Yahoo Finance 지수 스냅샷 (수집 시각별 기록).

    - 미국지수: 06:20 / 00:00 / 02:00 / 04:00 (KST) 등
    - 한국지수: 09:20 / 11:00 / 13:00 / 15:30 (KST) 등
    """
    __tablename__ = "yahoo_index_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    group = Column(String(10), nullable=False, index=True)  # 'us' | 'kr' | etc
    symbol = Column(String(30), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    market = Column(String(10), nullable=True)
    currency = Column(String(10), nullable=True)
    price = Column(Float, nullable=True)
    change = Column(Float, nullable=True)
    change_percent = Column(Float, nullable=True)
    regular_market_time = Column(Integer, nullable=True)  # yahoo meta regularMarketTime (epoch seconds)
    collected_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    collected_date = Column(Date, nullable=False, index=True)  # KST date 기준
    collected_time = Column(String(5), nullable=False, index=True)  # 'HH:MM' (KST)


class YahooIndexDaily(Base):
    """
    Yahoo Finance 지수 일별 최종값(해당 날짜의 마지막 수집값).

    date+symbol+group 으로 upsert하여 "기존 데이터를 덮어쓰되, 날짜별 마지막 값 저장" 요구사항을 만족.
    최근 7일 유지 정책은 스케줄러/서비스에서 정리한다.
    """
    __tablename__ = "yahoo_index_daily"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)  # KST date
    group = Column(String(10), nullable=False, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    market = Column(String(10), nullable=True)
    currency = Column(String(10), nullable=True)
    price = Column(Float, nullable=True)
    change = Column(Float, nullable=True)
    change_percent = Column(Float, nullable=True)
    last_collected_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_collected_time = Column(String(5), nullable=False)  # 'HH:MM' (KST)
    __table_args__ = (UniqueConstraint('date', 'group', 'symbol', name='uq_yahoo_index_daily'),)


class ExchangeRateSnapshot(Base):
    """환율 스냅샷 (30분마다 Yahoo Finance에서 수집)"""
    __tablename__ = "exchange_rate_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    currency = Column(String(10), nullable=False)
    rate = Column(Float, nullable=False)
    change_val = Column(Float, nullable=False)
    collected_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    collected_date = Column(Date, nullable=False, index=True)
    collected_time = Column(String(5), nullable=False)


class StockTerm(Base):
    """주식용어 사전 - 용어와 쉬운 설명을 저장"""
    __tablename__ = "stock_terms"
    id = Column(Integer, primary_key=True, index=True)
    term = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MasterQuote(Base):
  """대가들의 한마디 (명언 + 사진 URL)"""
  __tablename__ = "master_quotes"
  id = Column(Integer, primary_key=True, index=True)
  name = Column(String(100), nullable=False)        # 대가 이름
  title = Column(String(150), nullable=True)        # 직함/설명
  quote = Column(Text, nullable=False)              # 명언 텍스트
  image_url = Column(String(500), nullable=True)    # 사진 URL
  order_index = Column(Integer, nullable=False, default=0)
  is_active = Column(String(20), default="active")
  created_at = Column(DateTime(timezone=True), server_default=func.now())
  updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FaqCategory(Base):
    """FAQ 카테고리 (예: 계정, 주식 정보)"""
    __tablename__ = "faq_categories"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    items = relationship("FaqItem", back_populates="category", cascade="all, delete-orphan", order_by="FaqItem.order_index")


class FaqItem(Base):
    """FAQ 항목 (질문/답변)"""
    __tablename__ = "faq_items"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("faq_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category = relationship("FaqCategory", back_populates="items")


class LegalDocument(Base):
    """법적 문서 (개인정보처리방침, 이용약관)"""
    __tablename__ = "legal_documents"
    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String(30), nullable=False, unique=True, index=True)  # 'privacy' | 'terms'
    content = Column(Text, nullable=False, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
