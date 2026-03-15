"""
게시판 관리 라우터
"""
import os
import json
import re
from fastapi import APIRouter, Form, Request, Depends, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta, date
from typing import List, Optional

from app.dependencies import get_current_user, get_current_member, verify_api_key
from app.database import get_db
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


def format_author_name(author: str, db: Session = None) -> str:
    """
    작성자 이름을 포맷팅합니다.
    DB에서 관리자 여부를 확인하여 이름을 반환합니다.

    Args:
        author: 작성자 (이메일 또는 이름)
        db: DB 세션 (관리자 여부 확인용, 없으면 이메일 앞부분 사용)

    Returns:
        포맷팅된 작성자 이름
    """
    if not author:
        return '익명'

    # DB에서 관리자 계정인지 확인
    if db and '@' in author:
        admin_user = db.query(models.AdminUser).filter(
            models.AdminUser.email == author
        ).first()
        if admin_user:
            return author.split('@')[0]

    # 이메일 형식인 경우 @ 앞부분만 표시
    if '@' in author:
        return author.split('@')[0]

    return author

# [프론트엔드 전용 API] 게시판 목록 조회
@router.get("/api/boards")
async def get_boards_json(
    db: Session = Depends(get_db),
    _ = Depends(verify_api_key) # 시크릿 키 인증 적용
):
    boards = db.query(models.Board).order_by(models.Board.created_at).all()
    return {
        "success": True,
        "data": [
            {
                "id": b.id,
                "name": b.name,
                "type": b.type,
                "auth": b.auth,
                "use_categories": getattr(b, "use_categories", "false") or "false",
                "post_count": db.query(models.Post).filter(models.Post.board_id == b.id).count()
            } for b in boards
        ]
    }

    # [프론트엔드 전용 API] 특정 게시판의 게시글 목록 조회
@router.get("/api/boards/{board_id}/posts")
async def get_board_posts_json(
    board_id: str,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    _ = Depends(verify_api_key) # 시크릿 키 인증 적용
):
    skip = (page - 1) * limit
    from sqlalchemy.orm import joinedload
    all_posts = db.query(models.Post).options(
        joinedload(models.Post.category)
    ).filter(models.Post.board_id == board_id)\
     .order_by(models.Post.created_at.desc())\
     .all()
    
    # 비밀글 필터링: API Key로 호출하는 경우 모든 글 표시 (관리자 권한으로 간주)
    posts = all_posts
    
    return {
        "success": True,
        "data": [
            {
                "id": p.id,
                "title": p.title if p.is_secret != "true" else "🔒 비밀글",
                "author": p.author,
                "views": p.views,
                "is_secret": p.is_secret or "false",
                "is_member_only": getattr(p, "is_member_only", None) or "false",
                "created_at": p.created_at.isoformat(),
                "content": p.content or "",
                "category": p.category.name if p.category else None,
                "category_id": p.category_id
            } for p in posts[skip:skip+limit]
        ]
    }


def format_file_size(bytes: int) -> str:
    """파일 크기를 읽기 쉬운 형식으로 변환"""
    if not bytes or bytes == 0:
        return '0 Bytes'
    k = 1024
    sizes = ['Bytes', 'KB', 'MB', 'GB']
    i = int(bytes.bit_length() / 10) if bytes > 0 else 0
    i = min(i, len(sizes) - 1)
    return f"{round(bytes / (k ** i) * 100) / 100} {sizes[i]}"


def parse_attached_files(content: str) -> List[dict]:
    """content에서 첨부파일 정보를 파싱하여 반환"""
    if not content:
        return []

    files = []
    # HTML 주석에서 첨부 파일 정보 추출
    # 여러 패턴 시도: 공백이 있는 경우와 없는 경우
    patterns = [
        r'<!--\s*ATTACHED_FILES:\s*(\[[\s\S]*?\])\s*-->',  # 공백 포함
        r'<!--ATTACHED_FILES:(\[[\s\S]*?\])-->',  # 공백 없음
    ]

    match = None
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            break

    if match:
        try:
            json_str = match.group(1)
            files = json.loads(json_str)

            # 파일 크기 포맷팅 추가
            for file in files:
                if 'size' in file and file['size']:
                    file['formatted_size'] = format_file_size(file['size'])
        except (json.JSONDecodeError, Exception) as e:
            print(f"[ERROR] 첨부파일 파싱 오류: {e}")
            return []
    
    return files if isinstance(files, list) else []


def clean_content(content: str) -> str:
    """content에서 HTML 주석(첨부파일 정보)을 제거하여 반환"""
    if not content:
        return content
    
    # HTML 주석 제거 (첨부파일 정보 주석)
    cleaned = re.sub(r'<!--\s*ATTACHED_FILES:[\s\S]*?-->', '', content)
    return cleaned

# =========================================================
# [관리자용] 게시판 관리 기능
# =========================================================

@router.get("/admin/board", response_class=HTMLResponse)
async def admin_board_page(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return RedirectResponse(url="/")
    boards = db.query(models.Board).order_by(models.Board.created_at).all()
    return templates.TemplateResponse("board_admin.html", {
        "request": request, "admin_email": user.email, "boards": boards, "active_page": "board"
    })

@router.post("/admin/board/create")
async def create_board(
    name: str = Form(...),
    type: str = Form(...),
    auth: str = Form(...),
    use_categories: Optional[str] = Form("false"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user: return RedirectResponse(url="/", status_code=303)
    try:
        cnt = db.query(models.Board).count()
        new_id = f"B{cnt + 1:03d}"
        while db.query(models.Board).filter(models.Board.id == new_id).first():
            cnt += 1
            new_id = f"B{cnt + 1:03d}"
        uc = "true" if use_categories == "true" else "false"
        db.add(models.Board(id=new_id, name=name, type=type, auth=auth, use_categories=uc))
        db.commit()
        return RedirectResponse(url="/admin/board", status_code=303)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/board/update")
async def update_board(
    board_id: str = Form(...),
    name: str = Form(...),
    type: str = Form(...),
    auth: str = Form(...),
    use_categories: Optional[str] = Form("false"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user: return RedirectResponse(url="/", status_code=303)
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if board:
        board.name = name
        board.type = type
        board.auth = auth
        board.use_categories = "true" if use_categories == "true" else "false"
        db.commit()
    return RedirectResponse(url="/admin/board", status_code=303)

# ---- 게시판 카테고리 CRUD ----
@router.get("/admin/board/{board_id}/categories", response_class=HTMLResponse)
async def admin_board_categories_page(
    board_id: str,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user: return RedirectResponse(url="/")
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board: raise HTTPException(status_code=404)
    categories = db.query(models.BoardCategory).filter(
        models.BoardCategory.board_id == board_id
    ).order_by(models.BoardCategory.order_index, models.BoardCategory.id).all()
    return templates.TemplateResponse("board_categories.html", {
        "request": request, "board": board, "categories": categories, "admin_email": user.email, "active_page": "board"
    })

@router.post("/admin/board/{board_id}/categories/create")
async def create_board_category(
    board_id: str,
    name: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user: return RedirectResponse(url="/", status_code=303)
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board: raise HTTPException(status_code=404)
    max_order = db.query(models.BoardCategory).filter(
        models.BoardCategory.board_id == board_id
    ).count()
    db.add(models.BoardCategory(board_id=board_id, name=name.strip(), order_index=max_order))
    db.commit()
    return RedirectResponse(url=f"/admin/board/{board_id}/categories", status_code=303)

@router.post("/admin/board/{board_id}/categories/{cat_id}/update")
async def update_board_category(
    board_id: str,
    cat_id: int,
    name: str = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user: return RedirectResponse(url="/", status_code=303)
    cat = db.query(models.BoardCategory).filter(
        models.BoardCategory.id == cat_id,
        models.BoardCategory.board_id == board_id
    ).first()
    if cat:
        cat.name = name.strip()
        db.commit()
    return RedirectResponse(url=f"/admin/board/{board_id}/categories", status_code=303)

@router.get("/admin/board/{board_id}/categories/{cat_id}/delete")
async def delete_board_category(
    board_id: str,
    cat_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user: return RedirectResponse(url="/", status_code=303)
    cat = db.query(models.BoardCategory).filter(
        models.BoardCategory.id == cat_id,
        models.BoardCategory.board_id == board_id
    ).first()
    if cat:
        db.delete(cat)
        db.commit()
    return RedirectResponse(url=f"/admin/board/{board_id}/categories", status_code=303)

@router.get("/admin/board/delete/{board_id}")
async def delete_board(board_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return RedirectResponse(url="/", status_code=303)
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if board:
        db.delete(board)
        db.commit()
    return RedirectResponse(url="/admin/board", status_code=303)

@router.get("/admin/board/{board_id}/posts", response_class=HTMLResponse)
async def admin_board_posts_page(
    board_id: str,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user: return RedirectResponse(url="/")
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board: raise HTTPException(status_code=404)

    # 검색어(q) 쿼리 파라미터
    q = request.query_params.get("q", "").strip()

    # 기본 쿼리
    query = db.query(models.Post).filter(models.Post.board_id == board_id)

    # 제목/내용 검색
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Post.title.ilike(like),
                models.Post.content.ilike(like),
            )
        )

    posts = query.order_by(models.Post.created_at.desc()).all()

    now = datetime.now()
    cutoff = now - timedelta(hours=12)

    # timezone 정보 유무와 상관없이 비교 가능하도록 naive datetime으로 변환
    def _to_naive(dt: datetime) -> datetime:
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) is not None else dt

    new_post_ids = {
        p.id for p in posts
        if p.created_at and _to_naive(p.created_at) >= cutoff
    }

    return templates.TemplateResponse("admin_board_posts.html", {
        "request": request,
        "admin_email": user.email,
        "board": board,
        "posts": posts,
        "new_post_ids": new_post_ids,
        "search_query": q,
        "active_page": "board",
    })

@router.get("/admin/board/{board_id}/write", response_class=HTMLResponse)
async def admin_write_post_page(board_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return RedirectResponse(url="/")
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board: raise HTTPException(status_code=404)
    categories = []
    if getattr(board, "use_categories", "false") == "true":
        categories = db.query(models.BoardCategory).filter(
            models.BoardCategory.board_id == board_id
        ).order_by(models.BoardCategory.order_index, models.BoardCategory.id).all()
    return templates.TemplateResponse("admin_post_write.html", {
        "request": request, 
        "board": board, 
        "categories": categories,
        "admin_email": user.email,
        "active_page": "board"
    })

@router.post("/api/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    request: Request = None,
):
    """에디터 이미지 업로드 (관리자 또는 회원)"""
    # 관리자 또는 회원 확인
    member = await get_current_member(request)
    if not user and not member:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    
    # 이미지 파일만 허용
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    
    # 파일 크기 체크 (5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기는 5MB 이하여야 합니다.")
    
    try:
        from app.config import UPLOADS_DIR
        upload_dir = UPLOADS_DIR / "images"
        upload_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ") if file.filename else "image"
        safe_filename = f"{timestamp}_{safe_name}"
        file_path = upload_dir / safe_filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # URL 반환
        from fastapi.responses import JSONResponse

        # 절대 URL 생성: request.base_url 기준
        base_url = ""
        if request is not None:
            try:
                base_url = str(request.base_url).rstrip("/")
            except Exception:
                base_url = ""

        relative_url = f"/uploads/images/{safe_filename}"
        absolute_url = f"{base_url}{relative_url}" if base_url else relative_url

        return JSONResponse({"url": absolute_url})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 업로드 실패: {str(e)}")


def _parse_date(val: Optional[str]) -> Optional[date]:
    if not val or not val.strip():
        return None
    try:
        return datetime.strptime(val.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


@router.post("/admin/board/{board_id}/write")
async def admin_create_post(
    board_id: str,
    title: str = Form(...),
    content: str = Form(...),
    is_secret: Optional[str] = Form("false"),
    is_member_only: Optional[str] = Form("false"),
    member_only_grade: Optional[str] = Form("all"),
    member_only_start_date: Optional[str] = Form(None),
    member_only_end_date: Optional[str] = Form(None),
    public_visibility: Optional[str] = Form("full"),
    show_on_main: Optional[str] = Form("false"),
    category_id: Optional[int] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시글 작성 (파일 첨부 포함)"""
    if not user:
        return RedirectResponse(url="/")
    
    try:
        # 파일 저장 (게시글 저장 전에 먼저 처리)
        uploaded_files = []
        final_content = content  # 최종 content
        
        if files:
            from app.config import UPLOADS_DIR
            upload_dir = UPLOADS_DIR / "files"
            upload_dir.mkdir(parents=True, exist_ok=True)
            for file in files:
                if file and file.filename:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
                    safe_filename = f"{timestamp}_{safe_name}"
                    file_path = upload_dir / safe_filename
                    
                    # 파일 저장
                    try:
                        with open(file_path, "wb") as f:
                            content_data = await file.read()
                            f.write(content_data)
                        
                        # 파일 정보 저장
                        file_info = {
                            "filename": file.filename,
                            "path": f"/uploads/files/{safe_filename}",
                            "size": len(content_data),
                            "type": file.content_type or "application/octet-stream"
                        }
                        uploaded_files.append(file_info)
                    except Exception as e:
                        print(f"[ERROR] 파일 저장 실패: {file.filename}, 오류: {e}")
                        continue

            # 첨부 파일 정보를 content에 HTML 주석으로 추가
            if uploaded_files:
                import json
                files_json = json.dumps(uploaded_files, ensure_ascii=False)
                files_html = f'<!-- ATTACHED_FILES:{files_json} -->'
                final_content = content + files_html
        
        # 게시글 저장 (파일 정보가 포함된 content로 저장)
        new_post = models.Post(
            board_id=board_id,
            title=title.strip(),
            content=final_content,  # 파일 정보가 포함된 content 사용
            author=user.email,
            is_secret=is_secret if is_secret in ["true", "false"] else "false",
            is_member_only=is_member_only if is_member_only in ["true", "false"] else "false",
            member_only_grade=member_only_grade if member_only_grade in ["all", "vip", "family"] else "all",
            member_only_start_date=_parse_date(member_only_start_date),
            member_only_end_date=_parse_date(member_only_end_date),
            public_visibility=public_visibility if public_visibility in ["full", "partial"] else "full",
            show_on_main=show_on_main == "true",
            category_id=category_id if category_id else None,
            created_at=datetime.now()
        )
        db.add(new_post)
        db.flush()  # post.id를 얻기 위해 flush

        db.commit()

        # 앱 내 알림 생성 (비밀글 제외)
        try:
            if is_secret != "true":
                board_obj = db.query(models.Board).filter(models.Board.id == board_id).first()
                board_name = board_obj.name if board_obj else board_id
                noti = models.Notification(
                    type="new_post",
                    title=f"[{board_name}] {title.strip()}",
                    message=title.strip(),
                    link_url=f"/board/{new_post.id}?from={board_id}",
                    is_global="true",
                )
                db.add(noti)
                db.commit()
        except Exception as noti_err:
            pass

        # FCM 전체 푸시 (비밀글 제외)
        if is_secret != "true":
            try:
                from app.services.fcm_service import send_push_to_all
                import logging as _logging
                _fcm_logger = _logging.getLogger(__name__)
                board_obj = db.query(models.Board).filter(models.Board.id == board_id).first()
                board_name = board_obj.name if board_obj else board_id
                sent = await send_push_to_all(
                    db,
                    title=f"[{board_name}] 새 글이 등록됐습니다",
                    body=title.strip(),
                    data={"link_url": f"/board/{new_post.id}?from={board_id}", "type": "new_post"},
                )
                _fcm_logger.info(f"[FCM] 새 게시글 알림 전송 완료: {sent}건 (post_id={new_post.id})")
            except Exception as fcm_err:
                import logging as _logging
                _logging.getLogger(__name__).error(f"[FCM] 새 게시글 알림 전송 실패: {fcm_err}", exc_info=True)

        return RedirectResponse(url=f"/admin/board/{board_id}/posts", status_code=303)
    except Exception as e:
        db.rollback()
        print(f"게시글 작성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"게시글 작성 중 오류가 발생했습니다: {str(e)}")

@router.get("/admin/board/{board_id}/post/{post_id}", response_class=HTMLResponse)
async def admin_post_view(board_id: str, post_id: int, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return RedirectResponse(url="/")
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    # 비밀글 체크: 관리자는 모든 비밀글 조회 가능 (이 엔드포인트는 관리자 전용)
    
    # 첨부파일 정보 파싱 및 content 정리
    original_content = post.content or ""
    all_attachments = parse_attached_files(original_content)
    cleaned_content = clean_content(original_content)
    post.content = cleaned_content
    
    formatted_author = format_author_name(post.author or "", db)
    return templates.TemplateResponse("admin_post_view.html", {
        "request": request, 
        "board": {"id": board_id}, 
        "post": post,
        # 모든 첨부파일 전달 (이미지는 본문에도 들어갈 수 있지만, 다운로드 가능하도록 유지)
        "attachments": all_attachments,
        "admin_email": user.email,
        "formatted_author": formatted_author,
        "active_page": "board"
    })


@router.get("/admin/board/{board_id}/post/{post_id}/edit", response_class=HTMLResponse)
async def admin_post_edit_page(
    board_id: str, 
    post_id: int, 
    request: Request, 
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """게시글 수정 페이지"""
    if not user:
        return RedirectResponse(url="/")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    # content에서 첨부파일 주석 제거 (에디터에는 정리된 content만 표시)
    cleaned_content = clean_content(post.content or "")
    # Post 객체의 content를 정리된 버전으로 교체 (템플릿에서 사용)
    post.content = cleaned_content
    
    categories = []
    if getattr(board, "use_categories", "false") == "true":
        categories = db.query(models.BoardCategory).filter(
            models.BoardCategory.board_id == board_id
        ).order_by(models.BoardCategory.order_index, models.BoardCategory.id).all()
    show_on_main = getattr(post, "show_on_main", False)
    return templates.TemplateResponse("admin_post_edit.html", {
        "request": request,
        "board": board,
        "post": post,
        "categories": categories,
        "show_on_main": show_on_main,
        "admin_email": user.email,
        "active_page": "board"
    })


@router.post("/admin/board/{board_id}/post/{post_id}/edit")
async def admin_post_edit(
    board_id: str,
    post_id: int,
    title: str = Form(...),
    content: str = Form(...),
    is_secret: Optional[str] = Form("false"),
    is_member_only: Optional[str] = Form("false"),
    member_only_grade: Optional[str] = Form("all"),
    member_only_start_date: Optional[str] = Form(None),
    member_only_end_date: Optional[str] = Form(None),
    public_visibility: Optional[str] = Form("full"),
    show_on_main: Optional[str] = Form("false"),
    category_id: Optional[int] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시글 수정 처리"""
    if not user:
        return RedirectResponse(url="/")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    try:
        # 기존 첨부파일 정보 가져오기
        original_content = post.content or ""
        existing_attachments = parse_attached_files(original_content)
        
        # 새로 업로드된 파일 처리
        uploaded_files = []
        final_content = content
        
        if files:
            from app.config import UPLOADS_DIR
            upload_dir = UPLOADS_DIR / "files"
            upload_dir.mkdir(parents=True, exist_ok=True)
            for file in files:
                if file and file.filename:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
                    safe_filename = f"{timestamp}_{safe_name}"
                    file_path = upload_dir / safe_filename
                    try:
                        with open(file_path, "wb") as f:
                            content_data = await file.read()
                            f.write(content_data)
                        
                        file_info = {
                            "filename": file.filename,
                            "path": f"/uploads/files/{safe_filename}",
                            "size": len(content_data),
                            "type": file.content_type or "application/octet-stream"
                        }
                        uploaded_files.append(file_info)
                    except Exception as e:
                        print(f"[ERROR] 파일 저장 실패: {file.filename}, 오류: {e}")
                        continue

        # 기존 첨부파일과 새 첨부파일 합치기
        all_attachments = existing_attachments + uploaded_files

        # 첨부파일 정보를 content에 추가
        if all_attachments:
            import json
            files_json = json.dumps(all_attachments, ensure_ascii=False)
            files_html = f'<!-- ATTACHED_FILES:{files_json} -->'
            final_content = content + files_html

        # 게시글 업데이트
        post.title = title.strip()
        post.content = final_content
        post.is_secret = is_secret if is_secret in ["true", "false"] else "false"
        post.is_member_only = is_member_only if is_member_only in ["true", "false"] else "false"
        post.member_only_grade = member_only_grade if member_only_grade in ["all", "vip", "family"] else "all"
        post.member_only_start_date = _parse_date(member_only_start_date)
        post.member_only_end_date = _parse_date(member_only_end_date)
        post.public_visibility = public_visibility if public_visibility in ["full", "partial"] else "full"
        post.show_on_main = show_on_main == "true"
        post.category_id = category_id if category_id else None
        post.updated_at = datetime.now()

        db.commit()
        return RedirectResponse(url=f"/admin/board/{board_id}/post/{post_id}", status_code=303)
    except Exception as e:
        db.rollback()
        print(f"[ERROR] 게시글 수정 실패: {e}")
        raise HTTPException(status_code=500, detail=f"게시글 수정 중 오류가 발생했습니다: {str(e)}")


@router.get("/admin/board/{board_id}/post/{post_id}/delete")
async def admin_post_delete(
    board_id: str,
    post_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시글 삭제"""
    if not user:
        return RedirectResponse(url="/")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    try:
        # 첨부파일 삭제 (선택사항 - 필요시 구현)
        # 현재는 DB에서만 삭제하고 실제 파일은 유지
        
        db.delete(post)
        db.commit()
        return RedirectResponse(url=f"/admin/board/{board_id}/posts", status_code=303)
    except Exception as e:
        db.rollback()
        print(f"[ERROR] 게시글 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=f"게시글 삭제 중 오류가 발생했습니다: {str(e)}")


@router.post("/admin/board/{board_id}/posts/delete")
async def admin_posts_bulk_delete(
    board_id: str,
    post_ids: List[int] = Form(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시글 선택 삭제 (일괄 삭제)"""
    if not user:
        return RedirectResponse(url="/", status_code=303)

    # 빈 리스트 방어
    if not post_ids:
        return RedirectResponse(url=f"/admin/board/{board_id}/posts", status_code=303)

    try:
        # 해당 게시판에 속한 글만 삭제 (다른 게시판 글 ID 주입 방지)
        targets = db.query(models.Post).filter(
            models.Post.board_id == board_id,
            models.Post.id.in_(post_ids)
        ).all()

        for post in targets:
            db.delete(post)

        db.commit()
        return RedirectResponse(url=f"/admin/board/{board_id}/posts", status_code=303)
    except Exception as e:
        db.rollback()
        print(f"[ERROR] 게시글 선택 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=f"게시글 선택 삭제 중 오류가 발생했습니다: {str(e)}")


# =========================================================
# [사용자용] 게시판 & 방명록 (핵심 로직 수정됨)
# =========================================================

@router.get("/boards", response_class=HTMLResponse)
async def board_list_page(request: Request, db: Session = Depends(get_db)):
    """게시판 목록 (메인)"""
    boards = db.query(models.Board).order_by(models.Board.created_at).all()
    return templates.TemplateResponse("board_list.html", {"request": request, "boards": boards})


@router.get("/board/{board_id}", response_class=HTMLResponse)
async def board_detail_page(
    board_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    게시판 상세 화면 (목록)
    - 방명록형: [입력폼] -> [최신글 내용 목록] (board_detail.html에서 처리)
    - 일반형: [글쓰기 버튼] -> [제목 목록] (board_detail.html에서 처리)
    """
    # 1. 게시판 정보 조회
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    # 검색어(q) 쿼리 파라미터
    q = request.query_params.get("q", "").strip()

    # 2. 게시글 목록 조회 (최신순 정렬: created_at desc)
    # 비밀글은 작성자나 관리자만 목록에 표시
    query = db.query(models.Post).filter(
        models.Post.board_id == board_id
    )

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Post.title.ilike(like),
                models.Post.content.ilike(like),
            )
        )

    all_posts = query.order_by(models.Post.created_at.desc()).all()
    
    # 비밀글 필터링: 관리자는 모든 비밀글 조회 가능, 비로그인은 비밀글 제외
    posts = []
    for p in all_posts:
        if p.is_secret == "true":
            if user:  # 관리자(로그인된 사용자)는 모든 비밀글 볼 수 있음
                posts.append(p)
        else:
            # 일반 글은 모두 볼 수 있음
            posts.append(p)

    now = datetime.now()
    cutoff = now - timedelta(hours=12)

    # timezone 정보 유무와 상관없이 비교 가능하도록 naive datetime으로 변환
    def _to_naive(dt: datetime) -> datetime:
        return dt.replace(tzinfo=None) if getattr(dt, "tzinfo", None) is not None else dt

    new_post_ids = {
        p.id for p in posts
        if p.created_at and _to_naive(p.created_at) >= cutoff
    }
    
    # 각 게시글의 첨부파일 정보 파싱
    posts_with_attachments = []
    for post in posts:
        attachments = parse_attached_files(post.content or "")
        cleaned_content = clean_content(post.content or "")
        # 작성자 이름 포맷팅
        formatted_author = format_author_name(post.author or "", db)
        posts_with_attachments.append({
            "post": post,
            "attachments": attachments,
            "cleaned_content": cleaned_content,
            "is_new": post.id in new_post_ids,
            "formatted_author": formatted_author,
        })
    
    return templates.TemplateResponse("board_detail.html", {
        "request": request,
        "board": board,
        "posts_with_attachments": posts_with_attachments,
        "new_post_ids": new_post_ids,
        "is_admin": user is not None,
        "admin_email": user.email if user else None,
        "search_query": q,
    })


@router.post("/board/write")
async def public_create_post(
    board_id: str = Form(...),
    content: str = Form(...),         # 내용
    title: str = Form(None),          # 제목 (방명록은 없을 수 있음)
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    방명록 작성 처리 (관리자 전용)
    """
    if not user:
        raise HTTPException(status_code=401, detail="관리자 로그인이 필요합니다.")
    
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # 제목 처리: 방명록은 제목이 없으므로 자동 생성
    final_title = title
    if not final_title:
        if board.type in ["guestbook", "guest"]:
            # 내용의 앞 20자를 제목으로 사용
            final_title = content[:20] + "..." if len(content) > 20 else content
        else:
            final_title = "무제"

    # DB 저장 (로그인한 관리자 이메일을 author로 사용)
    new_post = models.Post(
        board_id=board_id,
        title=final_title,
        content=content,
        author=user.email,
        created_at=datetime.now()
    )
    
    db.add(new_post)
    db.commit()
    
    # 작성 후 다시 해당 게시판 페이지로 이동
    return RedirectResponse(url=f"/board/{board_id}", status_code=303)


# [일반 게시판 전용] 글쓰기 페이지 (방명록은 사용 안 함)
@router.get("/board/{board_id}/write", response_class=HTMLResponse)
async def public_write_page_view(board_id: str, request: Request, db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board: raise HTTPException(status_code=404)
    return templates.TemplateResponse("post_write_public.html", {"request": request, "board": board})


# [일반 게시판 전용] 상세 보기 페이지 (방명록은 사용 안 함)
@router.get("/board/{board_id}/post/{post_id}", response_class=HTMLResponse)
async def public_post_view_page(
    board_id: str, 
    post_id: int, 
    request: Request, 
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # 1. 게시판 정보 조회 (이전 코드에서 누락되어 에러 발생했던 부분 해결)
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판 없음")

    # 2. 게시글 정보 조회
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post: 
        raise HTTPException(status_code=404, detail="게시글 없음")
    
    # 3. 비밀글 체크: 관리자(로그인 상태)만 조회 가능
    if post.is_secret == "true" and not user:
        raise HTTPException(status_code=403, detail="비밀글은 작성자만 조회할 수 있습니다.")
    
    # 3. 조회수 증가
    post.views = (post.views or 0) + 1
    db.commit()
    
    # 4. 첨부파일 정보 파싱 및 content 정리
    attachments = parse_attached_files(post.content or "")
    # content에서 HTML 주석 제거 (첨부파일 정보 주석)
    cleaned_content = clean_content(post.content or "")
    # Post 객체의 content를 정리된 버전으로 교체 (템플릿에서 사용)
    post.content = cleaned_content
    
    # 5. 템플릿에 board와 post 모두 전달
    formatted_author = format_author_name(post.author or "", db)
    return templates.TemplateResponse("post_view.html", {
        "request": request, 
        "board": board, 
        "post": post,
        "attachments": attachments,
        "formatted_author": formatted_author
    })


# 방명록 수정 페이지
@router.get("/board/{board_id}/post/{post_id}/edit", response_class=HTMLResponse)
async def public_post_edit_page(
    board_id: str,
    post_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """방명록 수정 페이지 (관리자 전용)"""
    if not user:
        raise HTTPException(status_code=401, detail="관리자 로그인이 필요합니다.")
    
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    cleaned_content = clean_content(post.content or "")
    
    return templates.TemplateResponse("guestbook_edit.html", {
        "request": request,
        "board": board,
        "post": post,
        "cleaned_content": cleaned_content,
        "admin_email": user.email if user else None,
    })


# 방명록 수정 처리
@router.post("/board/{board_id}/post/{post_id}/edit")
async def public_post_edit(
    board_id: str,
    post_id: int,
    content: str = Form(...),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방명록 수정 처리 (관리자 전용)"""
    if not user:
        raise HTTPException(status_code=401, detail="관리자 로그인이 필요합니다.")
    
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    try:
        # 게시글 업데이트
        post.content = content
        post.updated_at = datetime.now()
        
        db.commit()
        return RedirectResponse(url=f"/board/{board_id}", status_code=303)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"게시글 수정 중 오류가 발생했습니다: {str(e)}")


# 방명록 삭제
@router.get("/board/{board_id}/post/{post_id}/delete")
async def public_post_delete(
    board_id: str,
    post_id: int,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방명록 삭제 (관리자 전용)"""
    if not user:
        raise HTTPException(status_code=401, detail="관리자 로그인이 필요합니다.")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    try:
        db.delete(post)
        db.commit()
        return RedirectResponse(url=f"/board/{board_id}", status_code=303)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"게시글 삭제 중 오류가 발생했습니다: {str(e)}")