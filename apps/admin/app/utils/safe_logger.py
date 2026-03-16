"""
안전한 로깅 유틸 (SECURITY_AUDIT 11번)
민감 정보(비밀번호, 토큰, API 키 등) 마스킹
"""
import os
import re

IS_PRODUCTION = bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("PRODUCTION"))

_SENSITIVE_KEYS = {"password", "passwd", "pwd", "secret", "token", "api_key", "apikey", "authorization"}


def _mask_sensitive(text: str) -> str:
    """문자열 내 민감 패턴 마스킹"""
    if not text or not isinstance(text, str):
        return str(text)
    # key=value 형태
    result = re.sub(
        r'(\b(?:password|passwd|token|api_key|secret)\s*[:=]\s*)[^\s,}\]]+',
        r'\1***MASKED***',
        text,
        flags=re.I
    )
    return result


def safe_log(message: str, *args, **kwargs):
    """민감 정보 마스킹 후 로깅"""
    if IS_PRODUCTION and args:
        print(message, *[_mask_sensitive(str(a)) for a in args], **kwargs)
    else:
        print(message, *args, **kwargs)


def safe_log_error(context: str, error: Exception):
    """에러 로깅 시 민감 정보 마스킹"""
    err_msg = _mask_sensitive(str(error))
    print(f"[{context}] {type(error).__name__}: {err_msg}")
