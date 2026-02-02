@echo off
REM 1. 가상환경 자동 활성화
call .\venv\Scripts\activate

REM 2. 환경 변수 설정 (소스 보안을 위해 .env 파일을 사용한다면 필요함)
set PYTHONPATH=.

REM 3. 서버 실행
uvicorn app.main:app --reload --port 8080