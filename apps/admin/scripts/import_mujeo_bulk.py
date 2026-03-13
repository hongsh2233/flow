#!/usr/bin/env python3
"""
무제.md → 대가들의 한마디 일괄 등록 스크립트

scripts/무제.md의 JSON 배열을 파싱하여 MasterPerson(없으면 생성)과 MasterQuote를 일괄 등록합니다.

사용법:
    cd apps/admin && python scripts/import_mujeo_bulk.py

옵션:
    --dry-run, -n  실제 DB 변경 없이 실행 (테스트용)

예시:
    cd apps/admin && python scripts/import_mujeo_bulk.py --dry-run
"""
import json
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import SessionLocal
from app import models


def load_mujeo_data() -> list[dict]:
    """무제.md에서 JSON 배열 로드 (scripts/무제.md 또는 apps/admin/scripts/무제.md)"""
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir / "무제.md",  # apps/admin/scripts/무제.md (Docker/빌드 시)
        BASE_DIR.parent / "scripts" / "무제.md",  # scripts/무제.md (로컬 개발)
    ]
    mujeo_path = next((p for p in candidates if p.exists()), None)
    if not mujeo_path:
        raise FileNotFoundError(f"무제.md를 찾을 수 없습니다. 다음 중 하나에 있어야 합니다: {[str(p) for p in candidates]}")
    text = mujeo_path.read_text(encoding="utf-8")
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("무제.md는 JSON 배열 형식이어야 합니다.")
    return data


def import_mujeo_bulk(dry_run: bool = False) -> tuple[int, int]:
    """
    무제.md 데이터를 대가들의 한마디에 일괄 등록
    Returns: (생성된 MasterPerson 수, 생성된 MasterQuote 수)
    """
    data = load_mujeo_data()
    db = SessionLocal()
    created_people = 0
    created_quotes = 0

    try:
        # unique master_name -> MasterPerson 생성
        seen_names: set[str] = set()
        for item in data:
            master_name = (item.get("master_name") or "").strip()
            if not master_name:
                continue
            if master_name in seen_names:
                continue
            seen_names.add(master_name)

            existing = db.query(models.MasterPerson).filter(
                models.MasterPerson.name == master_name
            ).first()
            if not existing:
                if dry_run:
                    print(f"  [DRY] MasterPerson 생성: {master_name}")
                    created_people += 1
                else:
                    person = models.MasterPerson(
                        name=master_name,
                        title="투자 대가",
                        image_url=None,
                        is_active="active",
                    )
                    db.add(person)
                    db.flush()
                    created_people += 1
                    print(f"  ✓ MasterPerson 생성: {master_name}")

        if not dry_run:
            db.commit()

        # MasterQuote 일괄 등록 (중복 방지: 동일 name+quote 조합은 스킵)
        existing_quotes = set()
        for row in db.query(models.MasterQuote).all():
            existing_quotes.add((row.name, row.quote.strip()))

        for item in data:
            master_name = (item.get("master_name") or "").strip()
            content = (item.get("content") or "").strip()
            if not master_name or not content:
                continue
            if (master_name, content) in existing_quotes:
                continue

            if dry_run:
                print(f"  [DRY] MasterQuote 추가: {master_name} - {content[:40]}...")
                created_quotes += 1
            else:
                quote = models.MasterQuote(
                    name=master_name,
                    title="투자 대가",
                    quote=content,
                    image_url=None,
                    order_index=0,
                    is_active="active",
                )
                db.add(quote)
                existing_quotes.add((master_name, content))
                created_quotes += 1
                print(f"  ✓ MasterQuote 추가: {master_name} - {content[:40]}...")

        if not dry_run:
            db.commit()

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

    return created_people, created_quotes


def main():
    dry_run = "--dry-run" in sys.argv or "-n" in sys.argv
    print("=" * 60)
    print("무제.md → 대가들의 한마디 일괄 등록")
    print("=" * 60)
    if dry_run:
        print("(DRY RUN - 실제 DB 변경 없음)")
    print()

    try:
        people, quotes = import_mujeo_bulk(dry_run=dry_run)
        print()
        print(f"완료: MasterPerson {people}개, MasterQuote {quotes}개 처리")
    except FileNotFoundError as e:
        print(f"❌ {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ 무제.md JSON 파싱 오류: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
