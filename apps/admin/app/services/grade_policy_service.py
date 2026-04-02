"""
등급 정책(GradePolicy) 배치: is_active·is_auto 정책에 따라 회원 등급·만료를 갱신하고 GradePolicyLog를 남깁니다.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Optional

import pytz
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models

KST = pytz.timezone("Asia/Seoul")
GRADE_RANK = {"regular": 0, "vip": 1, "family": 2}


def _now_kst() -> datetime:
    return datetime.now(KST)


def _parse_conditions(policy: models.GradePolicy) -> dict[str, Any]:
    cj = policy.conditions_json
    if cj is None:
        return {}
    if isinstance(cj, dict):
        return cj
    if isinstance(cj, str):
        try:
            return json.loads(cj)
        except json.JSONDecodeError:
            return {}
    return {}


def _favorite_count(member: models.Member) -> int:
    if not member.favorite_stocks:
        return 0
    try:
        data = json.loads(member.favorite_stocks)
        if isinstance(data, list):
            return len(data)
    except json.JSONDecodeError:
        pass
    return 0


def _post_count_for_member(db: Session, member: models.Member) -> int:
    if not member.email:
        return 0
    n = (
        db.query(func.count(models.Post.id))
        .filter(
            models.Post.author == member.email,
            models.Post.status == "approved",
        )
        .scalar()
    )
    return int(n or 0)


def member_matches_condition(
    db: Session, member: models.Member, condition_type: str, conditions: dict[str, Any]
) -> bool:
    if condition_type == "jubti_complete":
        return bool(member.jubti_type and str(member.jubti_type).strip())

    if condition_type == "join_days":
        days = int(conditions.get("days") or 0)
        if days <= 0 or member.created_at is None:
            return False
        created = member.created_at
        if created.tzinfo is None:
            created = pytz.UTC.localize(created)
        created_kst = created.astimezone(KST)
        return _now_kst() >= created_kst + timedelta(days=days)

    if condition_type == "post_count":
        need = int(conditions.get("count") or 0)
        return _post_count_for_member(db, member) >= need

    if condition_type == "favorite_count":
        need = int(conditions.get("count") or 0)
        return _favorite_count(member) >= need

    if condition_type == "login_days":
        return False

    if condition_type == "composite":
        operator = str(conditions.get("operator") or "AND").upper()
        rules = conditions.get("rules") or []
        if not rules:
            return False
        results: list[bool] = []
        for r in rules:
            if not isinstance(r, dict):
                results.append(False)
                continue
            ct = r.get("condition_type") or ""
            cj = r.get("conditions") if isinstance(r.get("conditions"), dict) else {}
            results.append(member_matches_condition(db, member, str(ct), cj))
        if operator == "OR":
            return any(results)
        return all(results)

    return False


def _member_rank(grade: Optional[str]) -> int:
    return GRADE_RANK.get((grade or "regular").lower(), 0)


def _already_applied(db: Session, policy_id: int, member_id: int) -> bool:
    return (
        db.query(models.GradePolicyLog)
        .filter(
            models.GradePolicyLog.policy_id == policy_id,
            models.GradePolicyLog.member_id == member_id,
        )
        .first()
        is not None
    )


def _apply_policy_to_member(db: Session, policy: models.GradePolicy, member: models.Member) -> bool:
    before = member.grade
    target = policy.target_grade
    if _member_rank(member.grade) >= _member_rank(target):
        return False

    now = _now_kst()
    member.grade = target
    if policy.benefit_days is not None and int(policy.benefit_days) > 0:
        member.grade_expires_at = now + timedelta(days=int(policy.benefit_days))
    else:
        member.grade_expires_at = None

    db.add(
        models.GradePolicyLog(
            policy_id=policy.id,
            member_id=member.id,
            before_grade=before,
            after_grade=target,
            applied_at=now,
            expires_at=member.grade_expires_at,
            trigger_source="auto",
        )
    )
    return True


def run_auto_grade_policies_sync(db: Session) -> int:
    """
    활성·자동 등급 정책을 한 번 실행합니다.
    Returns: 이번 실행에서 등급이 바뀐 회원 건수(정책 적용 횟수).
    """
    policies = (
        db.query(models.GradePolicy)
        .filter(models.GradePolicy.is_active.is_(True), models.GradePolicy.is_auto.is_(True))
        .order_by(models.GradePolicy.id)
        .all()
    )
    if not policies:
        return 0

    members = db.query(models.Member).filter(models.Member.status == "active").all()
    applied = 0
    try:
        for policy in policies:
            conds = _parse_conditions(policy)
            for member in members:
                if policy.upgrade_once and _already_applied(db, policy.id, member.id):
                    continue
                if not member_matches_condition(db, member, policy.condition_type, conds):
                    continue
                if _apply_policy_to_member(db, policy, member):
                    applied += 1
        db.commit()
    except Exception:
        db.rollback()
        raise

    print(f"✅ 등급 정책 배치 완료: 정책 {len(policies)}건, 신규 승급 {applied}건")
    return applied
