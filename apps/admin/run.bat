@echo off
REM Admin FastAPI 서버 실행 (Windows)
REM 반드시 이 파일이 있는 디렉터리(apps\admin)에서 실행하세요.

cd /d "%~dp0"

if not exist "venv\Scripts\activate.bat" (
    echo [오류] 가상환경이 없습니다. 먼저 아래를 실행하세요:
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    exit /b 1
)

call venv\Scripts\activate
set PYTHONPATH=.

REM 루트(jurin-i) .env.local 사용 — 없으면 admin\.env 사용
echo Admin 서버 시작 (port 8080) ...
uvicorn app.main:app --reload --port 8080