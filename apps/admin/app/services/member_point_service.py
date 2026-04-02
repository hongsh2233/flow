"""
회원 포인트 적립·차감 (Family는 자동 적립·차감 제외, VIP 환영 4900P 등)
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Tuple

import pytz
from sqlalchemy.orm import Session

from app import models

KST = pytz.timezone("Asia/Seoul")

POINT_SIGNUP = 100
POINT_DAILY_LOGIN = 20
POINT_JUBTI_FIRST = 50
POINT_POST_LIKE = 20
POINT_SCREENING_PICK = -20
POINT_VIP_WELCOME = 4900

REASON_SIGNUP = "signup_bonus"
REASON_DAILY_LOGIN = "daily_login"
REASON_JUBTI_FIRST = "jubti_first"
REASON_POST_LIKE = "post_like"
REASON_SCREENING_PICK = "screening_pick_over_quota"
REASON_VIP_WELCOME = "vip_welcome"


def _effective_grade(member: models.Member) -> str:
    grade = (member.grade or "regular").lower()
    if grade == "regular":
        return "regular"
    exp = getattr(member, "grade_expires_at", None)
    if exp is not None:
        now = datetime.utcnow()
        exp_naive = exp.replace(tzinfo=None) if exp.tzinfo else exp
        if exp_naive < now:
            return "regular"
    return grade


def member_points_frozen(member: models.Member) -> bool:
    """Family: 자동 포인트 적립·차감 비대상"""
    return _effective_grade(member) == "family"


def screening_free_rank_limit(member: models.Member) -> Optional[int]:
    """
    스크리닝 순위 기준 무료 담기 상한(포함). None이면 전 구간 무료(Family).
    regular=2, vip=5 — gradeTier.screeningVisibleRankCount 와 동일.
    """
    g = _effective_grade(member)
    if g == "family":
        return None
    if g == "vip":
        return 5
    return 2


def _today_kst() -> date:
    return datetime.now(KST).date()


def apply_point_change(
    db: Session,
    member_id: int,
    delta: int,
    reason: str,
    *,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    allow_family: bool = False,
) -> Tuple[bool, int, Optional[str]]:
    """
    포인트 변경. (성공 여부, 변경 후 잔액, 에러 메시지)
    Family는 allow_family=False일 때 delta!=0 이면 무시(성공, 잔액 유지).
    """
    member = (
        db.query(models.Member)
        .filter(models.Member.id == member_id)
        .with_for_update()
        .first()
    )
    if not member:
        return False, 0, "회원을 찾을 수 없습니다."

    if member_points_frozen(member) and not allow_family and delta != 0:
        return True, int(member.point_balance or 0), None

    if idempotency_key:
        exists = (
            db.query(models.MemberPointLedger.id)
            .filter(
                models.MemberPointLedger.member_id == member_id,
                models.MemberPointLedger.idempotency_key == idempotency_key,
            )
            .first()
        )
        if exists:
            return True, int(member.point_balance or 0), None

    bal = int(member.point_balance or 0)
    new_bal = bal + delta
    if new_bal < 0:
        return False, bal, "포인트가 부족합니다."

    member.point_balance = new_bal
    db.add(
        models.MemberPointLedger(
            member_id=member_id,
            delta=delta,
            balance_after=new_bal,
            reason=reason,
            ref_type=ref_type,
            ref_id=ref_id,
            idempotency_key=idempotency_key,
        )
    )
    db.flush()
    return True, new_bal, None


def grant_signup_bonus(db: Session, member: models.Member) -> None:
    if member_points_frozen(member):
        return
    key = f"signup_{member.id}"
    ok, _, _ = apply_point_change(
        db, member.id, POINT_SIGNUP, REASON_SIGNUP, idempotency_key=key
    )
    if ok:
        db.commit()


def grant_daily_login_bonus(db: Session, member: models.Member) -> None:
    if member_points_frozen(member):
        return
    today = _today_kst()
    if member.last_daily_login_bonus_date == today:
        return
    key = f"daily_login_{member.id}_{today.isoformat()}"
    ok, _, err = apply_point_change(
        db, member.id, POINT_DAILY_LOGIN, REASON_DAILY_LOGIN, idempotency_key=key
    )
    if not ok:
        db.rollback()
        return
    member.last_daily_login_bonus_date = today
    db.commit()


def grant_jubti_first_bonus(db: Session, member: models.Member) -> None:
    if member_points_frozen(member):
        return
    key = f"jubti_first_{member.id}"
    ok, _, _ = apply_point_change(
        db, member.id, POINT_JUBTI_FIRST, REASON_JUBTI_FIRST, idempotency_key=key
    )
    if ok:
        db.commit()


def grant_post_like_bonus(db: Session, member_id: int, post_id: int) -> None:
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member or member_points_frozen(member):
        return
    key = f"post_like_{member_id}_{post_id}"
    ok, _, _ = apply_point_change(
        db,
        member_id,
        POINT_POST_LIKE,
        REASON_POST_LIKE,
        ref_type="post",
        ref_id=str(post_id),
        idempotency_key=key,
    )
    if ok:
        db.commit()


def maybe_grant_vip_welcome_points(
    db: Session, member: models.Member, grade_before_raw: str
) -> None:
    """등급이 vip로 올라간 경우 1회 4900P (이전 등급이 vip가 아닐 때)"""
    if (grade_before_raw or "").lower() == "vip":
        return
    if _effective_grade(member) != "vip":
        return
    if member_points_frozen(member):
        return
    key = f"vip_welcome_{member.id}"
    ok, _, _ = apply_point_change(
        db,
        member.id,
        POINT_VIP_WELCOME,
        REASON_VIP_WELCOME,
        idempotency_key=key,
    )
    if ok:
        db.commit()


def charge_screening_pick_if_needed(
    db: Session,
    member: models.Member,
    *,
    rank: int,
    stock_code: str,
    screening_date: str,
    screening_type: str,
) -> Tuple[bool, bool, Optional[str]]:
    """
    스크리닝 담기: Family·무료 순위 이내면 차감 없음. 그 외 member/vip는 20P.
    Returns (ok, did_charge, error_message)
    """
    if member_points_frozen(member):
        return True, False, None

    limit = screening_free_rank_limit(member)
    if limit is None:
        return True, False, None
    if rank <= limit:
        return True, False, None

    key = f"screen_pick_{member.id}_{screening_type}_{screening_date}_{stock_code}"
    ok, _, err = apply_point_change(
        db,
        member.id,
        POINT_SCREENING_PICK,
        REASON_SCREENING_PICK,
        ref_type="screening_pick",
        ref_id=f"{screening_type}:{screening_date}:{stock_code}",
        idempotency_key=key,
    )
    if ok:
        db.commit()
        return True, True, None
    return False, False, err or "포인트 차감 실패"
