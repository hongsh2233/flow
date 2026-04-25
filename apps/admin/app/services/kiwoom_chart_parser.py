"""
ka10081 주식일봉차트 JSON → pandas OHLCV (Open/High/Low/Close/Volume).

키움 REST 응답 필드명이 버전별로 다를 수 있어 여러 후보 키를 시도한다.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _to_float(v: Any) -> float:
    if v is None:
        return float("nan")
    s = str(v).strip().replace(",", "")
    if not s or s == "-":
        return float("nan")
    s = re.sub(r"[^\d.\-+]", "", s)
    if not s:
        return float("nan")
    try:
        return float(s)
    except ValueError:
        return float("nan")


def _to_dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    s = re.sub(r"[^\d]", "", str(v).strip())
    if len(s) >= 8:
        try:
            return datetime.strptime(s[:8], "%Y%m%d")
        except ValueError:
            pass
    return None


def _pick(row: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in row and row[k] is not None and str(row[k]).strip() != "":
            return row[k]
    return None


def _row_to_ohlcv(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    """한 행에서 OHLCV + date 추출."""
    dt_raw = _pick(row, "dt", "bas_dt", "date", "trde_dt", "stk_dt")
    dt = _to_dt(dt_raw)
    o = _to_float(
        _pick(row, "open_pric", "opn_prc", "fpr_open", "open", "Open", "opnprc")
    )
    h = _to_float(
        _pick(row, "high_pric", "hg_pric", "high", "High", "hiprc")
    )
    low_v = _to_float(
        _pick(row, "low_pric", "lw_pric", "low", "Low", "lwprc")
    )
    c = _to_float(
        _pick(row, "cur_prc", "cls_prc", "close", "Close", "clprc")
    )
    vol = _to_float(
        _pick(row, "trde_qty", "trde_qty1", "vol", "Volume", "acc_trde_qty", "acml_vol")
    )
    if dt is None:
        return None
    if c != c:  # NaN close
        return None
    return {
        "Date": dt,
        "Open": o,
        "High": h,
        "Low": low_v,
        "Close": c,
        "Volume": vol if vol == vol else 0.0,
    }


def extract_chart_row_dicts(data: dict[str, Any]) -> list[dict[str, Any]]:
    """응답에서 일봉 행 dict 리스트 추출."""
    if not isinstance(data, dict):
        return []
    for key in ("output1", "output", "output2", "list", "stk_dt_pole"):
        v = data.get(key)
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return list(v)
    return []


def ka10081_pages_to_dataframe(rows: list[dict[str, Any]]):
    """
    여러 페이지를 합친 행 리스트 → DataFrame (Open, High, Low, Close, Volume).
    """
    import pandas as pd

    parsed = []
    for row in rows:
        p = _row_to_ohlcv(row)
        if p:
            parsed.append(p)
    if not parsed:
        return None
    df = pd.DataFrame(parsed)
    df = df.drop_duplicates(subset=["Date"], keep="last")
    df = df.sort_values("Date").reset_index(drop=True)
    for col in ("Open", "High", "Low"):
        if col in df.columns:
            df[col] = df[col].fillna(df["Close"])
    return df
