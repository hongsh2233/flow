"""
로그인 실패 횟수 제한 (SECURITY_AUDIT 10번)
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _identifier(email: str, ip: str) -> str:
    """이메일+IP 조합으로 식별자 생성"""
    return f"{email.strip().lower()}|{ip or 'unknown'}"


def check_locked(db: Session, email: str, ip: str) -> Tuple[bool, Optional[str]]:
    """
    잠금 여부 확인. (locked, message) 반환.
    """
    ident = _identifier(email, ip)
    now = datetime.utcnow()
    r = db.execute(
        text("""
            SELECT attempt_count, locked_until
            FROM login_attempts
            WHERE identifier = :ident
        """),
        {"ident": ident}
    )
    row = r.fetchone()
    if not row:
        return False, None
    attempt_count, locked_until = row
    if locked_until:
        locked_naive = locked_until.replace(tzinfo=None) if locked_until.tzinfo else locked_until
        if now < locked_naive:
            return True, f"너무 많은 로그인 시도입니다. {LOCKOUT_MINUTES}분 후 다시 시도해 주세요."
        # 잠금 만료됨 -> 초기화
        db.execute(
            text("""
                UPDATE login_attempts
                SET attempt_count = 0, locked_until = NULL, updated_at = :now
                WHERE identifier = :ident
            """),
            {"ident": ident, "now": now}
        )
        db.commit()
    return False, None


def record_failure(db: Session, email: str, ip: str) -> Tuple[int, bool]:
    """
    실패 기록. (현재 시도 횟수, 잠금됨 여부) 반환.
    """
    ident = _identifier(email, ip)
    now = datetime.utcnow()
    # PostgreSQL: unique index on identifier 필요
    r = db.execute(
        text("""
            INSERT INTO login_attempts (identifier, attempt_count, updated_at)
            VALUES (:ident, 1, :now)
            ON CONFLICT (identifier) DO UPDATE SET
                attempt_count = login_attempts.attempt_count + 1,
                updated_at = :now
            RETURNING attempt_count
        """),
        {"ident": ident, "now": now}
    )
    count = r.scalar() or 1
    if count >= MAX_ATTEMPTS:
        locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        db.execute(
            text("""
                UPDATE login_attempts
                SET locked_until = :locked_until, updated_at = :now
                WHERE identifier = :ident
            """),
            {"ident": ident, "locked_until": locked_until, "now": now}
        )
        db.commit()
        return count, True
    db.commit()
    return count, False


def clear_attempts(db: Session, email: str, ip: str) -> None:
    """로그인 성공 시 시도 기록 초기화"""
    ident = _identifier(email, ip)
    db.execute(text("DELETE FROM login_attempts WHERE identifier = :ident"), {"ident": ident})
    db.commit()
