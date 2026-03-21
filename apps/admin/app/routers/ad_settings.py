"""
설정 > 광고설정 — 알리익스프레스 어필리에이트 상품 등록 (단건 / TSV 붙여넣기)
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


def _affiliate_row_from_columns(cols: list[str]) -> Optional[dict[str, Any]]:
    cols = [c.strip() for c in cols]
    while cols and cols[-1] == "":
        cols.pop()
    if not cols or not cols[0]:
        return None

    def find_affiliate_url(parts: list[str]) -> str:
        for c in reversed(parts):
            if c.startswith("http") and ("aliexpress" in c or "click." in c):
                return c
        for c in reversed(parts):
            if c.startswith("http"):
                return c
        return ""

    n = len(cols)
    if n >= 15:
        return {
            "external_product_id": cols[0][:80],
            "image_url": cols[1] or None,
            "video_url": cols[2] or None,
            "title": (cols[3] or "")[:500] or None,
            "original_price": cols[4] or None,
            "sale_price": cols[5] or None,
            "discount_percent": cols[6] or None,
            "currency_code": cols[7] or "KRW",
            "stat_rating_primary": cols[8] or None,
            "stat_commission_primary": cols[9] or None,
            "stat_rating_secondary": cols[10] or None,
            "stat_commission_secondary": cols[11] or None,
            "sold_count": cols[12] or None,
            "feedback_percent": cols[13] or None,
            "affiliate_url": cols[14] or None,
        }

    aff = find_affiliate_url(cols)
    if not aff:
        return None
    img = cols[1] if n > 1 and cols[1].startswith("http") and "aliexpress" in cols[1] else None
    title = None
    if n > 3 and cols[3] and not cols[3].startswith("http"):
        title = cols[3][:500]
    elif n > 1 and cols[1] and not cols[1].startswith("http"):
        title = cols[1][:500]
    return {
        "external_product_id": cols[0][:80],
        "image_url": img,
        "video_url": None,
        "title": title,
        "original_price": cols[4] if n > 4 else None,
        "sale_price": cols[5] if n > 5 else None,
        "discount_percent": cols[6] if n > 6 else None,
        "currency_code": cols[7] if n > 7 else "KRW",
        "stat_rating_primary": cols[8] if n > 8 else None,
        "stat_commission_primary": cols[9] if n > 9 else None,
        "stat_rating_secondary": cols[10] if n > 10 else None,
        "stat_commission_secondary": cols[11] if n > 11 else None,
        "sold_count": cols[12] if n > 12 else None,
        "feedback_percent": cols[13] if n > 13 else None,
        "affiliate_url": aff,
    }


def _next_order_index(db: Session) -> int:
    last = (
        db.query(models.AliexpressAffiliateProduct)
        .order_by(models.AliexpressAffiliateProduct.order_index.desc())
        .first()
    )
    return (last.order_index + 1) if last else 0


def _row_to_model(data: dict[str, Any], order_index: int) -> models.AliexpressAffiliateProduct:
    return models.AliexpressAffiliateProduct(
        platform="aliexpress",
        external_product_id=data["external_product_id"],
        image_url=data.get("image_url"),
        video_url=data.get("video_url"),
        title=data.get("title"),
        original_price=data.get("original_price"),
        sale_price=data.get("sale_price"),
        discount_percent=data.get("discount_percent"),
        currency_code=data.get("currency_code") or "KRW",
        stat_rating_primary=data.get("stat_rating_primary"),
        stat_commission_primary=data.get("stat_commission_primary"),
        stat_rating_secondary=data.get("stat_rating_secondary"),
        stat_commission_secondary=data.get("stat_commission_secondary"),
        sold_count=data.get("sold_count"),
        feedback_percent=data.get("feedback_percent"),
        affiliate_url=data.get("affiliate_url"),
        is_active="active",
        order_index=order_index,
    )


@router.get("/admin/ad-settings", response_class=HTMLResponse)
async def ad_settings_page(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    rows = (
        db.query(models.AliexpressAffiliateProduct)
        .order_by(models.AliexpressAffiliateProduct.order_index, models.AliexpressAffiliateProduct.id)
        .all()
    )
    return templates.TemplateResponse(
        "admin_ad_settings.html",
        {
            "request": request,
            "admin_email": user.email,
            "products": rows,
            "active_page": "ad-settings",
        },
    )


@router.post("/admin/ad-settings/add")
async def ad_settings_add(
    external_product_id: str = Form(...),
    affiliate_url: str = Form(...),
    image_url: Optional[str] = Form(None),
    video_url: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    original_price: Optional[str] = Form(None),
    sale_price: Optional[str] = Form(None),
    discount_percent: Optional[str] = Form(None),
    currency_code: Optional[str] = Form("KRW"),
    stat_rating_primary: Optional[str] = Form(None),
    stat_commission_primary: Optional[str] = Form(None),
    stat_rating_secondary: Optional[str] = Form(None),
    stat_commission_secondary: Optional[str] = Form(None),
    sold_count: Optional[str] = Form(None),
    feedback_percent: Optional[str] = Form(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    pid = (external_product_id or "").strip()
    url = (affiliate_url or "").strip()
    if not pid or not url:
        return HTMLResponse(
            "<script>alert('제품 코드(상품 ID)와 제휴 링크는 필수입니다.'); history.back();</script>"
        )
    oi = _next_order_index(db)
    db.add(
        _row_to_model(
            {
                "external_product_id": pid[:80],
                "affiliate_url": url,
                "image_url": (image_url or "").strip() or None,
                "video_url": (video_url or "").strip() or None,
                "title": ((title or "").strip()[:500] or None),
                "original_price": (original_price or "").strip() or None,
                "sale_price": (sale_price or "").strip() or None,
                "discount_percent": (discount_percent or "").strip() or None,
                "currency_code": (currency_code or "").strip() or "KRW",
                "stat_rating_primary": (stat_rating_primary or "").strip() or None,
                "stat_commission_primary": (stat_commission_primary or "").strip() or None,
                "stat_rating_secondary": (stat_rating_secondary or "").strip() or None,
                "stat_commission_secondary": (stat_commission_secondary or "").strip() or None,
                "sold_count": (sold_count or "").strip() or None,
                "feedback_percent": (feedback_percent or "").strip() or None,
            },
            oi,
        )
    )
    db.commit()
    return RedirectResponse(url="/admin/ad-settings", status_code=303)


@router.post("/admin/ad-settings/bulk")
async def ad_settings_bulk(
    bulk_tsv: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    text = bulk_tsv or ""
    added = 0
    skipped = 0
    oi = _next_order_index(db)
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        cols = line.split("\t")
        data = _affiliate_row_from_columns(cols)
        if not data or not data.get("affiliate_url"):
            skipped += 1
            continue
        db.add(_row_to_model(data, oi))
        oi += 1
        added += 1
    db.commit()
    msg = f"등록 {added}건, 건너뜀 {skipped}행 (빈 줄·형식 불가·제휴 URL 없음)"
    from urllib.parse import quote

    return RedirectResponse(url=f"/admin/ad-settings?msg={quote(msg)}", status_code=303)


@router.get("/admin/ad-settings/edit/{item_id}", response_class=HTMLResponse)
async def ad_settings_edit_page(
    item_id: int,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    row = db.query(models.AliexpressAffiliateProduct).filter_by(id=item_id).first()
    if not row:
        return RedirectResponse(url="/admin/ad-settings")
    return templates.TemplateResponse(
        "admin_ad_settings_edit.html",
        {
            "request": request,
            "admin_email": user.email,
            "p": row,
            "active_page": "ad-settings",
        },
    )


@router.post("/admin/ad-settings/update/{item_id}")
async def ad_settings_update(
    item_id: int,
    external_product_id: str = Form(...),
    affiliate_url: str = Form(...),
    image_url: Optional[str] = Form(None),
    video_url: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    original_price: Optional[str] = Form(None),
    sale_price: Optional[str] = Form(None),
    discount_percent: Optional[str] = Form(None),
    currency_code: Optional[str] = Form("KRW"),
    stat_rating_primary: Optional[str] = Form(None),
    stat_commission_primary: Optional[str] = Form(None),
    stat_rating_secondary: Optional[str] = Form(None),
    stat_commission_secondary: Optional[str] = Form(None),
    sold_count: Optional[str] = Form(None),
    feedback_percent: Optional[str] = Form(None),
    is_active: str = Form("active"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    row = db.query(models.AliexpressAffiliateProduct).filter_by(id=item_id).first()
    if not row:
        return RedirectResponse(url="/admin/ad-settings", status_code=303)
    pid = (external_product_id or "").strip()
    url = (affiliate_url or "").strip()
    if not pid or not url:
        return HTMLResponse(
            "<script>alert('제품 코드(상품 ID)와 제휴 링크는 필수입니다.'); history.back();</script>"
        )
    row.external_product_id = pid[:80]
    row.affiliate_url = url
    row.image_url = (image_url or "").strip() or None
    row.video_url = (video_url or "").strip() or None
    row.title = (title or "").strip()[:500] or None
    row.original_price = (original_price or "").strip() or None
    row.sale_price = (sale_price or "").strip() or None
    row.discount_percent = (discount_percent or "").strip() or None
    row.currency_code = (currency_code or "").strip() or "KRW"
    row.stat_rating_primary = (stat_rating_primary or "").strip() or None
    row.stat_commission_primary = (stat_commission_primary or "").strip() or None
    row.stat_rating_secondary = (stat_rating_secondary or "").strip() or None
    row.stat_commission_secondary = (stat_commission_secondary or "").strip() or None
    row.sold_count = (sold_count or "").strip() or None
    row.feedback_percent = (feedback_percent or "").strip() or None
    row.is_active = is_active if is_active in ("active", "inactive") else "active"
    db.commit()
    return RedirectResponse(url="/admin/ad-settings", status_code=303)


@router.get("/admin/ad-settings/delete/{item_id}")
async def ad_settings_delete(
    item_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/", status_code=303)
    row = db.query(models.AliexpressAffiliateProduct).filter_by(id=item_id).first()
    if row:
        db.delete(row)
        db.commit()
    return RedirectResponse(url="/admin/ad-settings", status_code=303)
