-- members 테이블에 jubti_type(주BTI 투자 성향) 컬럼 추가
-- 실행: psql $DATABASE_URL -f app/migrations/add_jubti_type_column.sql
-- 또는 DB 클라이언트에서 아래 SQL 실행 (이미 있으면 무시)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'jubti_type'
  ) THEN
    ALTER TABLE members ADD COLUMN jubti_type VARCHAR(10) NULL;
  END IF;
END $$;
