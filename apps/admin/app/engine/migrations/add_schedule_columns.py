"""
일정 테이블에 subject, content 컬럼 추가 마이그레이션
기존 title 컬럼이 있다면 subject로 데이터를 이전하고 title 컬럼을 제거합니다.
"""
from sqlalchemy import text
from app.database import engine, SessionLocal


def migrate_schedule_table():
    """schedules 테이블 마이그레이션 실행"""
    db = SessionLocal()
    try:
        # 1. subject 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'schedules' 
            AND COLUMN_NAME = 'subject'
        """))
        has_subject = result.fetchone() is not None
        
        # 2. title 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'schedules' 
            AND COLUMN_NAME = 'title'
        """))
        has_title = result.fetchone() is not None
        
        # 3. subject 컬럼이 없으면 추가
        if not has_subject:
            print("📝 subject 컬럼 추가 중...")
            # 먼저 NULL 허용으로 추가
            db.execute(text("ALTER TABLE schedules ADD COLUMN subject VARCHAR(255) NULL AFTER date"))
            db.commit()
            
            # 기존 title 데이터가 있으면 subject로 복사
            if has_title:
                db.execute(text("UPDATE schedules SET subject = title WHERE subject IS NULL"))
                db.commit()
            
            # 이제 NOT NULL로 변경
            db.execute(text("ALTER TABLE schedules MODIFY COLUMN subject VARCHAR(255) NOT NULL DEFAULT ''"))
            db.commit()
            print("✅ subject 컬럼 추가 완료")
        
        # 4. content 컬럼이 있는지 확인
        result = db.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'schedules' 
            AND COLUMN_NAME = 'content'
        """))
        has_content = result.fetchone() is not None
        
        # 5. content 컬럼이 없으면 추가
        if not has_content:
            print("📝 content 컬럼 추가 중...")
            db.execute(text("ALTER TABLE schedules ADD COLUMN content VARCHAR(500) AFTER subject"))
            db.commit()
            print("✅ content 컬럼 추가 완료")
        
        # 6. title 컬럼이 있고 subject 컬럼이 이미 있다면 데이터 이전 후 제거
        if has_title and has_subject:
            # subject가 비어있는 경우에만 title 데이터 복사
            result = db.execute(text("SELECT COUNT(*) as cnt FROM schedules WHERE (subject IS NULL OR subject = '') AND title IS NOT NULL"))
            count = result.fetchone()[0]
            if count > 0:
                print(f"📝 title 데이터를 subject로 이전 중... ({count}개 행)")
                db.execute(text("""
                    UPDATE schedules 
                    SET subject = title 
                    WHERE (subject IS NULL OR subject = '') AND title IS NOT NULL
                """))
                db.commit()
                print("✅ 데이터 이전 완료")
            
            # title 컬럼 제거
            print("📝 title 컬럼 제거 중...")
            db.execute(text("ALTER TABLE schedules DROP COLUMN title"))
            db.commit()
            print("✅ title 컬럼 제거 완료")
        
        print("🎉 마이그레이션 완료!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_schedule_table()

