"""
데이터베이스 모델 정의 (PostgreSQL 호환)
"""
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.engine.database import Base

__all__ = ["Base", "CollectedData", "AdminUser", "Schedule", "Board", "Post", "KrxData", "FscStockPrice", "FscRisingStock", "RefreshToken", "Member", "Character", "StockWord", "MainPageItem", "Banner", "NaverStockRanking"]


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
    profile_image = Column(String(500), nullable=True)
    provider = Column(String(20), nullable=False, index=True)
    provider_id = Column(String(255), nullable=False, index=True)
    status = Column(String(20), default="active")
    favorite_stocks = Column(Text, nullable=True)
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
    subject = Column(String(255), nullable=False)
    content = Column(String(500))
    type = Column(String(20), default="manual")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Board(Base):
    __tablename__ = "boards"
    id = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)
    auth = Column(String(20), nullable=False, default="all")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    posts = relationship("Post", back_populates="board", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(String(20), ForeignKey("boards.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(100))
    views = Column(Integer, default=0)
    is_secret = Column(String(20), default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    board = relationship("Board", back_populates="posts")


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
    image_url = Column(String(500), nullable=False)
    link_url = Column(String(500), nullable=True)
    alt_text = Column(String(200), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_active = Column(String(20), default="active")
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
