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
from datetime import datetime, timedelta
from typing import List, Optional

from app.dependencies import get_current_user, get_current_member, verify_api_key
from app.config import ADMIN_EMAIL
from app.database import get_db
from app import models

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")

def format_author_name(author: str, admin_email: str = None) -> str:
    """
    작성자 이름을 포맷팅합니다.
    관리자 이메일인 경우 이름으로 변환합니다.
    
    Args:
        author: 작성자 (이메일 또는 이름)
        admin_email: 관리자 이메일 (선택)
    
    Returns:
        포맷팅된 작성자 이름
    """
    if not author:
        return '익명'
    
    # 관리자 이메일인 경우 이름으로 변환
    if admin_email and author == admin_email:
        # 이메일의 @ 앞부분을 이름으로 사용
        return author.split('@')[0] if '@' in author else '관리자'
    
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
    all_posts = db.query(models.Post).filter(models.Post.board_id == board_id)\
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
                "created_at": p.created_at.isoformat()
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
        print("[DEBUG] parse_attached_files: content가 비어있음")
        return []
    
    files = []
    # HTML 주석에서 첨부 파일 정보 추출
    # 여러 패턴 시도: 공백이 있는 경우와 없는 경우
    patterns = [
        r'<!--\s*ATTACHED_FILES:\s*(\[[\s\S]*?\])\s*-->',  # 공백 포함
        r'<!--ATTACHED_FILES:(\[[\s\S]*?\])-->',  # 공백 없음
    ]
    
    match = None
    matched_pattern = None
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            matched_pattern = pattern
            print(f"[DEBUG] parse_attached_files: 패턴 매칭 성공")
            break
    
    if match:
        try:
            json_str = match.group(1)
            print(f"[DEBUG] parse_attached_files: JSON 문자열 길이 = {len(json_str)}")
            files = json.loads(json_str)
            print(f"[DEBUG] parse_attached_files: 파싱 성공, 파일 개수 = {len(files) if isinstance(files, list) else 0}")
            
            # 파일 크기 포맷팅 추가
            for file in files:
                if 'size' in file and file['size']:
                    file['formatted_size'] = format_file_size(file['size'])
                print(f"[DEBUG] 파일 정보: filename={file.get('filename')}, path={file.get('path')}, type={file.get('type')}")
        except (json.JSONDecodeError, Exception) as e:
            print(f"[ERROR] 첨부파일 파싱 오류: {e}")
            print(f"[ERROR] JSON 문자열 (처음 500자): {json_str[:500] if 'json_str' in locals() else 'N/A'}")
            return []
    else:
        print(f"[DEBUG] parse_attached_files: 주석 패턴을 찾을 수 없음")
        print(f"[DEBUG] content 샘플 (마지막 500자): {content[-500:]}")
    
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
        "request": request, "admin_email": ADMIN_EMAIL, "boards": boards, "active_page": "board"
    })

@router.post("/admin/board/create")
async def create_board(name: str = Form(...), type: str = Form(...), auth: str = Form(...), user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return RedirectResponse(url="/", status_code=303)
    try:
        cnt = db.query(models.Board).count()
        new_id = f"B{cnt + 1:03d}"
        while db.query(models.Board).filter(models.Board.id == new_id).first():
            cnt += 1
            new_id = f"B{cnt + 1:03d}"
        
        db.add(models.Board(id=new_id, name=name, type=type, auth=auth))
        db.commit()
        return RedirectResponse(url="/admin/board", status_code=303)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/board/update")
async def update_board(board_id: str = Form(...), name: str = Form(...), type: str = Form(...), auth: str = Form(...), user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return RedirectResponse(url="/", status_code=303)
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if board:
        board.name = name
        board.type = type
        board.auth = auth
        db.commit()
    return RedirectResponse(url="/admin/board", status_code=303)

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
        "admin_email": ADMIN_EMAIL,
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
    return templates.TemplateResponse("admin_post_write.html", {
        "request": request, 
        "board": board, 
        "admin_email": ADMIN_EMAIL, 
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
        # uploads/images 디렉토리 생성
        upload_dir = "uploads/images"
        os.makedirs(upload_dir, exist_ok=True)
        
        # 파일명 생성
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ") if file.filename else "image"
        safe_filename = f"{timestamp}_{safe_name}"
        file_path = os.path.join(upload_dir, safe_filename)
        
        # 파일 저장
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


@router.post("/admin/board/{board_id}/write")
async def admin_create_post(
    board_id: str,
    title: str = Form(...),
    content: str = Form(...),
    is_secret: Optional[str] = Form("false"),
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
            # uploads/files 디렉토리 생성
            upload_dir = "uploads/files"
            os.makedirs(upload_dir, exist_ok=True)
            
            for file in files:
                if file and file.filename:
                    # 파일명 중복 방지를 위해 타임스탬프 추가
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    # 파일명에서 특수문자 제거
                    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
                    safe_filename = f"{timestamp}_{safe_name}"
                    file_path = os.path.join(upload_dir, safe_filename)
                    
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
                        print(f"[DEBUG] 파일 저장 성공: {file.filename} -> {file_path}")
                    except Exception as e:
                        print(f"[ERROR] 파일 저장 실패: {file.filename}, 오류: {e}")
                        continue
            
            # 첨부 파일 정보를 content에 HTML 주석으로 추가
            if uploaded_files:
                import json
                files_json = json.dumps(uploaded_files, ensure_ascii=False)
                files_html = f'<!-- ATTACHED_FILES:{files_json} -->'
                final_content = content + files_html
                print(f"[DEBUG] 첨부파일 정보 추가: {len(uploaded_files)}개 파일")
                print(f"[DEBUG] 첨부파일 JSON: {files_json[:200]}...")  # 처음 200자만 출력
        
        # 게시글 저장 (파일 정보가 포함된 content로 저장)
        new_post = models.Post(
            board_id=board_id,
            title=title.strip(),
            content=final_content,  # 파일 정보가 포함된 content 사용
            author=ADMIN_EMAIL,
            is_secret=is_secret if is_secret in ["true", "false"] else "false",
            created_at=datetime.now()
        )
        db.add(new_post)
        db.flush()  # post.id를 얻기 위해 flush
        
        db.commit()
        print(f"[DEBUG] 게시글 저장 완료: post_id={new_post.id}, 첨부파일={len(uploaded_files)}개")
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
    
    # 비밀글 체크: 작성자나 관리자만 조회 가능
    if post.is_secret == "true" and post.author != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="비밀글은 작성자만 조회할 수 있습니다.")
    
    # 첨부파일 정보 파싱 및 content 정리
    original_content = post.content or ""
    all_attachments = parse_attached_files(original_content)
    cleaned_content = clean_content(original_content)
    post.content = cleaned_content
    
    # 디버깅용 로그
    print(f"[DEBUG] admin_post_view - post_id: {post_id}")
    print(f"[DEBUG] all_attachments count: {len(all_attachments) if all_attachments else 0}")
    if all_attachments:
        print(f"[DEBUG] all_attachments: {all_attachments}")
    
    formatted_author = format_author_name(post.author or "", ADMIN_EMAIL)
    return templates.TemplateResponse("admin_post_view.html", {
        "request": request, 
        "board": {"id": board_id}, 
        "post": post,
        # 모든 첨부파일 전달 (이미지는 본문에도 들어갈 수 있지만, 다운로드 가능하도록 유지)
        "attachments": all_attachments,
        "admin_email": ADMIN_EMAIL,
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
    
    return templates.TemplateResponse("admin_post_edit.html", {
        "request": request,
        "board": board,
        "post": post,
        "admin_email": ADMIN_EMAIL,
        "active_page": "board"
    })


@router.post("/admin/board/{board_id}/post/{post_id}/edit")
async def admin_post_edit(
    board_id: str,
    post_id: int,
    title: str = Form(...),
    content: str = Form(...),
    is_secret: Optional[str] = Form("false"),
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
            upload_dir = "uploads/files"
            os.makedirs(upload_dir, exist_ok=True)
            
            for file in files:
                if file and file.filename:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
                    safe_filename = f"{timestamp}_{safe_name}"
                    file_path = os.path.join(upload_dir, safe_filename)
                    
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
                        print(f"[DEBUG] 새 파일 저장 성공: {file.filename}")
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
            print(f"[DEBUG] 수정된 첨부파일 정보 추가: {len(all_attachments)}개 파일")
        
        # 게시글 업데이트
        post.title = title.strip()
        post.content = final_content
        post.is_secret = is_secret if is_secret in ["true", "false"] else "false"
        post.updated_at = datetime.now()
        
        db.commit()
        print(f"[DEBUG] 게시글 수정 완료: post_id={post_id}")
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
        print(f"[DEBUG] 게시글 삭제 완료: post_id={post_id}")
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
        print(f"[DEBUG] 게시글 선택 삭제 완료: board_id={board_id}, requested={len(post_ids)}, deleted={len(targets)}")
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
    
    # 비밀글 필터링: 작성자나 관리자만 볼 수 있음
    posts = []
    for p in all_posts:
        if p.is_secret == "true":
            # 관리자는 모든 비밀글 볼 수 있음
            if user:
                posts.append(p)
            # 작성자만 볼 수 있음 (일반 사용자는 제외)
            elif p.author == ADMIN_EMAIL:
                # 관리자 전용이므로 관리자만 볼 수 있음
                if user:
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
        formatted_author = format_author_name(post.author or "", ADMIN_EMAIL)
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
        "admin_email": ADMIN_EMAIL if user else None,
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

    # DB 저장 (관리자 이메일을 author로 사용)
    new_post = models.Post(
        board_id=board_id,
        title=final_title,
        content=content,
        author=ADMIN_EMAIL,
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
    
    # 3. 비밀글 체크: 작성자나 관리자만 조회 가능
    if post.is_secret == "true":
        # 관리자는 항상 조회 가능
        if not user:
            raise HTTPException(status_code=403, detail="비밀글은 작성자만 조회할 수 있습니다.")
        # 작성자 체크 (관리자 이메일과 비교)
        if post.author != ADMIN_EMAIL:
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
    formatted_author = format_author_name(post.author or "", ADMIN_EMAIL)
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
        "admin_email": ADMIN_EMAIL,
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