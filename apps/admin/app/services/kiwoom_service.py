"""
Kiwoom REST API client: OAuth2 token (/oauth2/token) and TR calls.

See docs (migration guide) and https://openapi.kiwoom.com/guide/apiguide
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx

from app import config

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")


class KiwoomApiError(Exception):
    """Kiwoom API or transport error."""

    def __init__(self, message: str, *, details: Any = None):
        super().__init__(message)
        self.details = details


def _kiwoom_base_url() -> str:
    if getattr(config, "KIWOOM_BASE_URL", None):
        return str(config.KIWOOM_BASE_URL).rstrip("/")
    if config.KIWOOM_USE_MOCK:
        return "https://mockapi.kiwoom.com"
    return "https://api.kiwoom.com"


def _response_indicates_invalid_token(data: dict[str, Any]) -> bool:
    """True if Kiwoom body says access token is invalid (e.g. code 8005); enables one refresh+retry."""
    rc = data.get("return_code")
    if rc == 8005 or str(rc).strip() == "8005":
        return True
    msg = str(data.get("return_msg") or "")
    msg_cd = str(data.get("return_msg_cd") or "")
    if "8005" in msg or "8005" in msg_cd:
        return True
    low = msg.lower()
    if "token" in low and ("invalid" in low or "expired" in low):
        return True
    return False


def _parse_expires_dt(raw: Optional[str]) -> Optional[datetime]:
    if not raw or not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw.strip(), "%Y%m%d%H%M%S").replace(tzinfo=KST)
    except ValueError:
        logger.warning("KIWOOM: failed to parse expires_dt (%s)", raw)
        return None


# Domestic stock REST paths (see https://openapi.kiwoom.com — category별 URL)
STKINFO_PATH = "/api/dostk/stkinfo"  # 종목정보 (ka10001, ka00198, …)
RKINFO_PATH = "/api/dostk/rkinfo"  # 순위정보 (ka10020–ka10040, ka10030, …)
MRKCOND_PATH = "/api/dostk/mrkcond"  # 시세·호가 (api-id별 stk_cd 등; ka00198 불가)
ACNT_PATH = "/api/dostk/acnt"  # 계좌 (kt00001, kt00005, …)
ORDR_PATH = "/api/dostk/ordr"  # 현물 주문 (kt10000–kt10003, …)
CHART_PATH = "/api/dostk/chart"  # 차트 (ka10081 일봉 등)

# TR ids — Kiwoom REST guide (domestic stock ranking / info)
API_REALTIME_LOOKUP_RANK = "ka00198"  # 실시간 종목 조회 순위 → stkinfo
API_DAY_VOLUME_TOP = "ka10030"  # 당일거래량상위 → rkinfo
API_PREV_DAY_VOLUME_TOP = "ka10031"  # 전일거래량상위 → rkinfo
API_TRADING_VALUE_TOP = "ka10032"  # 거래대금상위 → rkinfo
API_UPPER_LOWER_LIMIT = "ka10017"  # 상하한가요청 → mrkcond
API_FOREIGN_CONSEC_NET = "ka10035"  # 외인연속순매매상위 → rkinfo
API_FOREIGN_STK_TRADE = "ka10008"  # 주식외국인종목별매매동향 → stkinfo (종목코드)
API_BROKER_RANK_BY_STK = "ka10038"  # 종목별증권사순위 → rkinfo (종목코드)
API_INSTITUTIONAL_DAILY = "ka10044"  # 일별기관매매종목 → mrkcond (종목코드)


class KiwoomService:
    """Cached access token + domestic stkinfo / rkinfo TRs."""

    def __init__(self, base_url: str, app_key: str, app_secret: str):
        self._base_url = base_url.rstrip("/")
        self._app_key = app_key
        self._app_secret = app_secret
        self._token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    async def _request_token(self) -> str:
        url = f"{self._base_url}/oauth2/token"
        body = {
            "grant_type": "client_credentials",
            "appkey": self._app_key,
            "secretkey": self._app_secret,
        }
        headers = {"Content-Type": "application/json;charset=UTF-8"}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(url, headers=headers, json=body)
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPStatusError as e:
            text = e.response.text[:500] if e.response else ""
            raise KiwoomApiError(
                f"Token HTTP error ({e.response.status_code if e.response else '?'})",
                details=text or str(e),
            ) from e
        except httpx.RequestError as e:
            raise KiwoomApiError(f"Token request failed: {e}") from e
        except ValueError as e:
            raise KiwoomApiError("Token response is not JSON", details=str(e)) from e

        if not isinstance(data, dict):
            raise KiwoomApiError("Token response has invalid shape", details=data)

        rc = data.get("return_code")
        if rc is not None and rc != 0:
            raise KiwoomApiError(
                data.get("return_msg") or "Token request failed",
                details=data,
            )

        token = data.get("token")
        if not token:
            raise KiwoomApiError("Token missing in response", details=data)

        exp = _parse_expires_dt(data.get("expires_dt"))
        if exp is None:
            exp = datetime.now(tz=KST) + timedelta(hours=1)

        self._token = str(token).strip()
        self._token_expires_at = exp
        logger.debug(
            "KIWOOM: token issued, base_url=%s expires_dt=%s",
            self._base_url,
            data.get("expires_dt"),
        )
        return self._token

    async def get_access_token(self) -> str:
        margin = timedelta(seconds=60)
        now = datetime.now(tz=KST)
        if (
            self._token
            and self._token_expires_at
            and now < self._token_expires_at - margin
        ):
            return self._token
        return await self._request_token()

    def get_token_expires_at(self) -> Optional[datetime]:
        """Cached token expiry (KST), if known."""
        return self._token_expires_at

    def _invalidate_token(self) -> None:
        self._token = None
        self._token_expires_at = None

    async def fetch_stock_basic_info(self, stk_cd: str) -> dict[str, Any]:
        """ka10001: POST /api/dostk/stkinfo"""
        return await self.call_dostk(STKINFO_PATH, "ka10001", {"stk_cd": stk_cd})

    async def call_dostk(
        self,
        path: str,
        api_id: str,
        body: dict[str, Any],
        *,
        cont_yn: str = "N",
        next_key: str = "",
        _token_retry: bool = False,
    ) -> dict[str, Any]:
        """POST /api/dostk/… (path = STKINFO_PATH | RKINFO_PATH | MRKCOND_PATH, …)."""
        token = await self.get_access_token()
        url = f"{self._base_url}{path}"
        # RFC 7230 관례상 Authorization(대문자). 일부 게이트웨이는 소문자만 문제 삼는 경우가 있어 명시.
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "Authorization": f"Bearer {token}",
            "api-id": api_id,
            "cont-yn": cont_yn,
            "next-key": next_key or "",
        }
        tag = path.rsplit("/", 1)[-1] or path
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                r = await client.post(url, headers=headers, json=body)
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPStatusError as e:
            code = e.response.status_code if e.response else 0
            if code == 401 and not _token_retry:
                logger.warning(
                    "KIWOOM: HTTP 401 on %s; clearing token and retrying once (api-id=%s)",
                    tag,
                    api_id,
                )
                self._invalidate_token()
                return await self.call_dostk(
                    path, api_id, body, cont_yn=cont_yn, next_key=next_key, _token_retry=True
                )
            text = e.response.text[:500] if e.response else ""
            raise KiwoomApiError(
                f"{tag} HTTP error ({code})",
                details=text or str(e),
            ) from e
        except httpx.RequestError as e:
            raise KiwoomApiError(f"{tag} request failed: {e}") from e
        except ValueError as e:
            raise KiwoomApiError(f"{tag} response is not JSON", details=str(e)) from e

        if not isinstance(data, dict):
            raise KiwoomApiError(f"{tag} response has invalid shape", details=data)

        if _response_indicates_invalid_token(data) and not _token_retry:
            logger.warning(
                "KIWOOM: invalid-token message in body; clearing cache and retrying once (api-id=%s)",
                api_id,
            )
            self._invalidate_token()
            return await self.call_dostk(
                path, api_id, body, cont_yn=cont_yn, next_key=next_key, _token_retry=True
            )

        return data

    async def call_tr(
        self,
        path: str,
        api_id: str,
        body: dict[str, Any],
        *,
        cont_yn: str = "N",
        next_key: str = "",
    ) -> dict[str, Any]:
        """Alias for call_dostk — generic TR POST to /api/dostk/… paths."""
        return await self.call_dostk(path, api_id, body, cont_yn=cont_yn, next_key=next_key)

    async def call_acnt(
        self,
        api_id: str,
        body: dict[str, Any],
        *,
        cont_yn: str = "N",
        next_key: str = "",
    ) -> dict[str, Any]:
        """POST /api/dostk/acnt (계좌 TR)."""
        return await self.call_dostk(ACNT_PATH, api_id, body, cont_yn=cont_yn, next_key=next_key)

    async def call_ordr(
        self,
        api_id: str,
        body: dict[str, Any],
        *,
        cont_yn: str = "N",
        next_key: str = "",
    ) -> dict[str, Any]:
        """POST /api/dostk/ordr (현물 주문 TR)."""
        return await self.call_dostk(ORDR_PATH, api_id, body, cont_yn=cont_yn, next_key=next_key)

    async def call_chart(
        self,
        api_id: str,
        body: dict[str, Any],
        *,
        cont_yn: str = "N",
        next_key: str = "",
    ) -> dict[str, Any]:
        """POST /api/dostk/chart (일봉·분봉 등)."""
        return await self.call_dostk(CHART_PATH, api_id, body, cont_yn=cont_yn, next_key=next_key)

    async def fetch_realtime_lookup_rank(
        self,
        *,
        mrkt_tp: str = "000",
        start_rank: int = 1,
        end_rank: int = 50,
    ) -> dict[str, Any]:
        """ka00198 realtime lookup rank. mrkt_tp: 000 all, 001 KOSPI, 101 KOSDAQ (3-digit)."""
        body = {
            "mrkt_tp": mrkt_tp,
            "st_rnkg": str(start_rank),
            "ed_rnkg": str(end_rank),
        }
        return await self.call_dostk(STKINFO_PATH, API_REALTIME_LOOKUP_RANK, body)

    async def fetch_day_volume_top(
        self,
        *,
        mrkt_tp: str = "000",
        sort_tp: str = "1",
        mang_stk_incls: str = "0",
        crd_tp: str = "0",
        trde_qty_tp: str = "0",
        pric_tp: str = "0",
        trde_prica_tp: str = "0",
        mrkt_open_tp: str = "0",
        stex_tp: str = "3",
    ) -> dict[str, Any]:
        """ka10030 same-day volume top (rkinfo); defaults match admin markdown sample."""
        body = {
            "mrkt_tp": mrkt_tp,
            "sort_tp": sort_tp,
            "mang_stk_incls": mang_stk_incls,
            "crd_tp": crd_tp,
            "trde_qty_tp": trde_qty_tp,
            "pric_tp": pric_tp,
            "trde_prica_tp": trde_prica_tp,
            "mrkt_open_tp": mrkt_open_tp,
            "stex_tp": stex_tp,
        }
        return await self.call_dostk(RKINFO_PATH, API_DAY_VOLUME_TOP, body)

    async def fetch_prev_day_volume_top(
        self,
        *,
        mrkt_tp: str = "000",
        sort_tp: str = "1",
        mang_stk_incls: str = "0",
        crd_tp: str = "0",
        trde_qty_tp: str = "0",
        pric_tp: str = "0",
        trde_prica_tp: str = "0",
        mrkt_open_tp: str = "0",
        stex_tp: str = "3",
    ) -> dict[str, Any]:
        """ka10031 전일거래량상위 — rkinfo, ka10030과 동일 파라미터 패턴(문서 기준)."""
        body = {
            "mrkt_tp": mrkt_tp,
            "sort_tp": sort_tp,
            "mang_stk_incls": mang_stk_incls,
            "crd_tp": crd_tp,
            "trde_qty_tp": trde_qty_tp,
            "pric_tp": pric_tp,
            "trde_prica_tp": trde_prica_tp,
            "mrkt_open_tp": mrkt_open_tp,
            "stex_tp": stex_tp,
        }
        return await self.call_dostk(RKINFO_PATH, API_PREV_DAY_VOLUME_TOP, body)

    async def fetch_trading_value_top(
        self,
        *,
        mrkt_tp: str = "000",
        mang_stk_incls: str = "0",
        crd_tp: str = "0",
        trde_qty_tp: str = "0",
        pric_tp: str = "0",
        trde_prica_tp: str = "0",
        mrkt_open_tp: str = "0",
        stex_tp: str = "3",
    ) -> dict[str, Any]:
        """ka10032 거래대금상위 — sort_tp=3 거래대금(당일거래량상위 예제와 동일 구조)."""
        body = {
            "mrkt_tp": mrkt_tp,
            "sort_tp": "3",
            "mang_stk_incls": mang_stk_incls,
            "crd_tp": crd_tp,
            "trde_qty_tp": trde_qty_tp,
            "pric_tp": pric_tp,
            "trde_prica_tp": trde_prica_tp,
            "mrkt_open_tp": mrkt_open_tp,
            "stex_tp": stex_tp,
        }
        return await self.call_dostk(RKINFO_PATH, API_TRADING_VALUE_TOP, body)

    async def fetch_upper_lower_limit(
        self,
        *,
        mrkt_tp: str = "000",
        stex_tp: str = "3",
    ) -> dict[str, Any]:
        """ka10017 상하한가요청 — mrkcond. 필드는 공식 가이드와 다를 수 있음."""
        body = {"mrkt_tp": mrkt_tp, "stex_tp": stex_tp}
        return await self.call_dostk(MRKCOND_PATH, API_UPPER_LOWER_LIMIT, body)

    async def fetch_foreign_consecutive_net_top(
        self,
        *,
        mrkt_tp: str = "000",
        st_rnkg: int = 1,
        ed_rnkg: int = 50,
        stex_tp: str = "3",
    ) -> dict[str, Any]:
        """ka10035 외인연속순매매상위 — rkinfo."""
        body = {
            "mrkt_tp": mrkt_tp,
            "st_rnkg": str(st_rnkg),
            "ed_rnkg": str(ed_rnkg),
            "stex_tp": stex_tp,
        }
        return await self.call_dostk(RKINFO_PATH, API_FOREIGN_CONSEC_NET, body)

    async def fetch_foreign_trading_by_stock(self, stk_cd: str) -> dict[str, Any]:
        """ka10008 주식외국인종목별매매동향 — stkinfo."""
        code = normalize_stk_cd(stk_cd)
        return await self.call_dostk(STKINFO_PATH, API_FOREIGN_STK_TRADE, {"stk_cd": code})

    async def fetch_broker_rank_by_stock(self, stk_cd: str) -> dict[str, Any]:
        """ka10038 종목별증권사순위 — rkinfo(종목코드)."""
        code = normalize_stk_cd(stk_cd)
        return await self.call_dostk(
            RKINFO_PATH,
            API_BROKER_RANK_BY_STK,
            {"stk_cd": code, "stex_tp": "3"},
        )

    async def fetch_institutional_daily(self, stk_cd: str) -> dict[str, Any]:
        """ka10044 일별기관매매종목요청 — mrkcond."""
        code = normalize_stk_cd(stk_cd)
        return await self.call_dostk(MRKCOND_PATH, API_INSTITUTIONAL_DAILY, {"stk_cd": code})


def rank_rows_from_response(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Pick list of row dicts from Kiwoom stkinfo/rkinfo JSON body."""
    if not isinstance(data, dict):
        return []
    rc = data.get("return_code")
    if rc is not None and rc != 0:
        return []

    _skip = frozenset(
        {
            "return_code",
            "return_msg",
            "return_msg_cd",
            "cont_yn",
            "next_key",
        }
    )

    for key in ("output", "output1", "out_rec", "stk_rank", "rank_list", "list"):
        v = data.get(key)
        if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
            return list(v)

    for k, v in data.items():
        if k in _skip:
            continue
        if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
            return list(v)
    return []




# rkinfo / stkinfo row keys -> Korean column headers (unknown keys stay as-is)
KIWOOM_STK_COLUMN_KO: dict[str, str] = {
    "stk_cd": "\uc885\ubaa9\ucf54\ub4dc",
    "stk_nm": "\uc885\ubaa9\uba85",
    "cur_prc": "\ud604\uc7ac\uac00",
    "pred_pre_sig": "\uc804\uc77c\ub300\ube44\uae30\ud638",
    "pred_pre": "\uc804\uc77c\ub300\ube44",
    "flu_rt": "\ub4f1\ub77d\uc728",
    "trde_qty": "\uac70\ub798\ub7c9",
    "pred_rt": "\uc804\uc77c\ube44",
    "trde_tern_rt": "\uac70\ub798\ud68c\uc804\uc728",
    "trde_amt": "\uac70\ub798\ub300\uae08",
    "opmr_trde_qty": "\uc7a5\uc911\uac70\ub798\ub7c9",
    "opmr_pred_rt": "\uc7a5\uc911\ub4f1\ub77d\uc728",
    "opmr_trde_rt": "\uc7a5\uc911\uac70\ub798\ube44\uc911",
    "opmr_trde_amt": "\uc7a5\uc911\uac70\ub798\ub300\uae08",
    "af_mkrt_trde_qty": "\uc2dc\uac04\uc678\uac70\ub798\ub7c9",
    "af_mkrt_pred_rt": "\uc2dc\uac04\uc678\ub4f1\ub77d\uc728",
    "af_mkrt_trde_rt": "\uc2dc\uac04\uc678\uac70\ub798\ube44\uc911",
    "af_mkrt_trde_amt": "\uc2dc\uac04\uc678\uac70\ub798\ub300\uae08",
    "bf_mkrt_trde_qty": "\uc7a5\uc804\uac70\ub798\ub7c9",
    "bf_mkrt_pred_rt": "\uc7a5\uc804\ub4f1\ub77d\uc728",
    "bf_mkrt_trde_rt": "\uc7a5\uc804\uac70\ub798\ube44\uc911",
    "bf_mkrt_trde_amt": "\uc7a5\uc804\uac70\ub798\ub300\uae08",
}

_KIWOOM_SIGNED_COLS = frozenset(
    {
        "flu_rt",
        "pred_rt",
        "opmr_pred_rt",
        "af_mkrt_pred_rt",
        "bf_mkrt_pred_rt",
        "opmr_trde_rt",
        "af_mkrt_trde_rt",
        "bf_mkrt_trde_rt",
        "pred_pre",
        "cur_prc",
    }
)


def kiwoom_column_label_ko(key: str) -> str:
    k = (key or "").strip()
    return KIWOOM_STK_COLUMN_KO.get(k, k)


def _direction_from_pre_sig(sig: str) -> str:
    """pred_pre_sig: 1/2 upper-side, 4/5 lower-side, else flat (3 = unchanged)."""
    s = (sig or "").strip()
    if s in ("1", "2"):
        return "up"
    if s in ("4", "5"):
        return "down"
    return "flat"


def _direction_from_value(val: Any, fallback_sig: str) -> str:
    raw = str(val).strip() if val is not None else ""
    if not raw or raw == "-":
        return _direction_from_pre_sig(fallback_sig)
    if raw.startswith("+"):
        return "up"
    if raw.startswith("-"):
        return "down"
    cleaned = raw.replace(",", "").rstrip("%").strip()
    try:
        n = float(cleaned)
        if n > 0:
            return "up"
        if n < 0:
            return "down"
    except ValueError:
        pass
    return _direction_from_pre_sig(fallback_sig)


def kiwoom_quotes_td_class(row: dict[str, Any], col_key: str) -> str:
    """Red (up) / blue (down) / neutral for rate and price columns."""
    ck = (col_key or "").strip()
    if ck not in _KIWOOM_SIGNED_COLS or not isinstance(row, dict):
        return ""
    sig = str(row.get("pred_pre_sig", "")).strip()

    if ck == "cur_prc":
        d = _direction_from_pre_sig(sig)
    elif ck == "pred_pre":
        d = _direction_from_value(row.get("pred_pre"), sig)
    else:
        d = _direction_from_value(row.get(ck), sig)

    if d == "up":
        return "kw-stk-up"
    if d == "down":
        return "kw-stk-down"
    return "kw-stk-flat"


_kiwoom_singleton: Optional[KiwoomService] = None
_kiwoom_singleton_sig: Optional[tuple[str, str, str]] = None


def get_kiwoom_service() -> Optional[KiwoomService]:
    """Return service instance only when app key and secret are set.

    KIWOOM_USE_MOCK / KIWOOM_BASE_URL / 키가 바뀌면 싱글톤을 새로 만들어
    실전·모의 도메인 불일치로 남은 토큰/베이스 URL 문제를 방지한다.
    """
    global _kiwoom_singleton, _kiwoom_singleton_sig
    key = (config.KIWOOM_APP_KEY or "").strip()
    secret = (config.KIWOOM_APP_SECRET or "").strip()
    if not key or not secret:
        return None
    base = _kiwoom_base_url()
    sig = (key, secret, base)
    if _kiwoom_singleton is None or _kiwoom_singleton_sig != sig:
        _kiwoom_singleton = KiwoomService(base, key, secret)
        _kiwoom_singleton_sig = sig
        logger.info(
            "KIWOOM: service (re)created for base_url=%s mock=%s",
            base,
            bool(getattr(config, "KIWOOM_USE_MOCK", False)),
        )
    return _kiwoom_singleton


def normalize_stk_cd(code: str) -> str:
    s = (code or "").strip()
    if not s:
        raise ValueError("종목코드를 입력하세요.")
    if not s.isdigit():
        raise ValueError("종목코드는 숫자만 입력할 수 있습니다.")
    if len(s) > 6:
        raise ValueError("종목코드는 최대 6자리입니다.")
    return s.zfill(6)
