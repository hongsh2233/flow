"""
Kiwoom ka10081 daily bars + same algorithms as stock-screening tabs:
ichimoku, jongbe (closing logic), ricebowl, breakout (surge expectation).

Universe: top N by market cap from FDR (BO caps TR volume).
Jongbe/breakout normally rank trading value on the full market; here ranking
is within this universe only, then TOP100 / TOP 150 and the same condition checks.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.services.breakout_screening_service import _analyze_stock_breakout
from app.services.jongbe_screening_service import _analyze_stock_jongbe
from app.services.kiwoom_price_service import get_kiwoom_price_service
from app.services.ricebowl_screening_service import _analyze_stock_ricebowl
from app.services.stock_screening_service import analyze_ichimoku_dataframe

logger = logging.getLogger(__name__)

MAX_TOP_N = 120
DEFAULT_TOP_N = 40
DEFAULT_CONCURRENCY = 4

SCREENING_MODES = frozenset({"ichimoku", "jongbe", "ricebowl", "breakout"})

_MIN_ROWS: dict[str, int] = {
    "ichimoku": 250,
    "jongbe": 20,
    "ricebowl": 250,
    "breakout": 130,
}

_JONGBE_TOP = 100
_BREAKOUT_TOP = 150


def _list_top_symbols_with_mcap(market: str, top_n: int) -> list[tuple[str, str, float]]:
    """Top market-cap names: (code, name, marcap in eok won)."""
    try:
        import FinanceDataReader as fdr
    except ImportError as e:
        raise ImportError(
            "FinanceDataReader is required. In apps/admin run: "
            "`pip install finance-datareader` or `pip install -r requirements.txt`."
        ) from e

    m = (market or "kospi").strip().lower()
    listing_name = "KOSPI" if m == "kospi" else "KOSDAQ"
    try:
        listing = fdr.StockListing(listing_name)
    except Exception:
        return []

    marcap_col = None
    for candidate in ["Marcap", "MarketCap", "marcap", "marketcap"]:
        if candidate in listing.columns:
            marcap_col = candidate
            break
    if marcap_col:
        listing = listing.sort_values(marcap_col, ascending=False)
    else:
        return []

    listing = listing.head(max(1, min(int(top_n), MAX_TOP_N)))

    code_col = None
    for candidate in ["Code", "Symbol", "code", "symbol"]:
        if candidate in listing.columns:
            code_col = candidate
            break
    name_col = None
    for candidate in ["Name", "name", "종목명"]:
        if candidate in listing.columns:
            name_col = candidate
            break
    if not code_col or not name_col:
        return []

    out: list[tuple[str, str, float]] = []
    for _, row in listing.iterrows():
        symbol = str(row[code_col]).strip()
        name = str(row[name_col]).strip()
        if not symbol or len(symbol) != 6 or not symbol.isdigit():
            continue
        mcap_won = float(row[marcap_col]) if row[marcap_col] == row[marcap_col] else 0.0
        mcap_eok = mcap_won / 1_0000_0000
        out.append((symbol, name, mcap_eok))
    return out


async def run_kiwoom_screening(
    *,
    mode: str,
    market: str,
    top_n: int = DEFAULT_TOP_N,
    max_concurrent: int = DEFAULT_CONCURRENCY,
) -> dict[str, Any]:
    """mode: ichimoku | jongbe | ricebowl | breakout"""
    raw_mode = (mode or "ichimoku").strip().lower()
    if raw_mode not in SCREENING_MODES:
        raw_mode = "ichimoku"

    m = (market or "kospi").strip().lower()
    if m not in ("kospi", "kosdaq"):
        m = "kospi"

    n = max(1, min(int(top_n), MAX_TOP_N))
    conc = max(1, min(int(max_concurrent), 8))
    min_rows = _MIN_ROWS[raw_mode]

    price = get_kiwoom_price_service()
    if price is None:
        return {
            "ok": False,
            "error": "KIWOOM_APP_KEY / KIWOOM_APP_SECRET 미설정",
            "mode": raw_mode,
            "results": [],
            "skipped": [],
            "market": m,
        }

    try:
        symbols = await asyncio.to_thread(_list_top_symbols_with_mcap, m, n)
    except ImportError as e:
        return {
            "ok": False,
            "error": str(e),
            "mode": raw_mode,
            "results": [],
            "skipped": [],
            "market": m,
        }

    if not symbols:
        return {
            "ok": False,
            "error": "Could not load symbol list (FDR).",
            "mode": raw_mode,
            "results": [],
            "skipped": [],
            "market": m,
        }

    sem = asyncio.Semaphore(conc)
    skipped: list[dict[str, str]] = []
    ohlcv_ok: list[tuple[str, str, float, Any]] = []

    async def _fetch_one(code: str, name: str, mcap_eok: float) -> None:
        async with sem:
            try:
                df = await price.fetch_daily_ohlcv_dataframe(
                    code, min_rows=min_rows, max_pages=60
                )
                if df is None or len(df) < min_rows:
                    skipped.append(
                        {
                            "stock_code": code,
                            "reason": f"insufficient rows (need {min_rows}) or parse failed",
                        }
                    )
                    return
                ohlcv_ok.append((code, name, mcap_eok, df))
            except Exception as e:
                logger.debug("kiwoom screening %s %s: %s", raw_mode, code, e)
                skipped.append({"stock_code": code, "reason": str(e)[:200]})

    await asyncio.gather(*[_fetch_one(c, nm, mc) for c, nm, mc in symbols])

    results: list[dict[str, Any]] = []

    if raw_mode == "ichimoku":
        for code, name, _mcap, df in ohlcv_ok:
            try:
                hit = analyze_ichimoku_dataframe(df, code, name)
                if hit:
                    hit["data_source"] = "kiwoom_ka10081"
                    results.append(hit)
            except Exception as e:
                logger.debug("ichimoku %s: %s", code, e)
                skipped.append({"stock_code": code, "reason": str(e)[:200]})
        results.sort(key=lambda x: x.get("stock_code", ""))

    elif raw_mode == "jongbe":
        trading_values: list[tuple[str, str, float, float, Any]] = []
        for code, name, mcap_eok, df in ohlcv_ok:
            if mcap_eok < 500:
                continue
            df = df.reset_index(drop=True)
            curr = df.iloc[-1]
            tv = float(curr["Close"]) * float(curr["Volume"])
            trading_values.append((code, name, mcap_eok, tv, df))
        trading_values.sort(key=lambda x: x[3], reverse=True)
        top_k = min(_JONGBE_TOP, len(trading_values))
        for rank_idx, (code, name, mcap_eok, _tv, df) in enumerate(trading_values[:top_k], 1):
            try:
                hit = _analyze_stock_jongbe(code, name, df, rank_idx, mcap_eok)
                if hit:
                    hit["data_source"] = "kiwoom_ka10081"
                    results.append(hit)
            except Exception as e:
                logger.debug("jongbe %s: %s", code, e)
                skipped.append({"stock_code": code, "reason": str(e)[:200]})

    elif raw_mode == "breakout":
        trading_values = []
        for code, name, mcap_eok, df in ohlcv_ok:
            if mcap_eok < 500:
                continue
            df = df.reset_index(drop=True)
            curr = df.iloc[-1]
            tv = float(curr["Close"]) * float(curr["Volume"])
            trading_values.append((code, name, mcap_eok, tv, df))
        trading_values.sort(key=lambda x: x[3], reverse=True)
        top_k = min(_BREAKOUT_TOP, len(trading_values))
        for rank_idx, (code, name, mcap_eok, _tv, df) in enumerate(trading_values[:top_k], 1):
            try:
                hit = _analyze_stock_breakout(code, name, df, rank_idx, mcap_eok)
                if hit:
                    hit["data_source"] = "kiwoom_ka10081"
                    results.append(hit)
            except Exception as e:
                logger.debug("breakout %s: %s", code, e)
                skipped.append({"stock_code": code, "reason": str(e)[:200]})

    else:  # ricebowl
        for code, name, mcap_eok, df in ohlcv_ok:
            if mcap_eok < 300:
                continue
            try:
                hit = _analyze_stock_ricebowl(code, name, df, mcap_eok)
                if hit:
                    hit["data_source"] = "kiwoom_ka10081"
                    results.append(hit)
            except Exception as e:
                logger.debug("ricebowl %s: %s", code, e)
                skipped.append({"stock_code": code, "reason": str(e)[:200]})
        results.sort(
            key=lambda x: float(str(x.get("trading_value", "0")).replace(",", "") or 0),
            reverse=True,
        )

    return {
        "ok": True,
        "mode": raw_mode,
        "market": m,
        "top_n": n,
        "universe_size": len(symbols),
        "hit_count": len(results),
        "results": results,
        "skipped_sample": skipped[:30],
        "skipped_count": len(skipped),
        "note": (
            "종목 범위는 시총 상위 N으로 제한합니다(TR 부하). 종베·급등예상의 거래대금 순위는 이 N종목 안에서만 계산한 후 동일 조건을 적용합니다."
        ),
    }


async def run_kiwoom_ichimoku_screening(
    *,
    market: str,
    top_n: int = DEFAULT_TOP_N,
    max_concurrent: int = DEFAULT_CONCURRENCY,
) -> dict[str, Any]:
    """Backward-compatible name for ichimoku-only runs."""
    return await run_kiwoom_screening(
        mode="ichimoku",
        market=market,
        top_n=top_n,
        max_concurrent=max_concurrent,
    )
