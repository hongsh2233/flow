# Admin FastAPI 서버 실행 (PowerShell)
# Activate.ps1 없이 venv의 python으로 직접 실행 (실행 정책 오류 회피)

Set-Location $PSScriptRoot

$venvPython = "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[오류] 가상환경이 없습니다. CMD에서 아래를 실행하세요:" -ForegroundColor Red
    Write-Host "  python -m venv venv"
    Write-Host "  venv\Scripts\activate"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

$env:PYTHONPATH = "."
Write-Host "Admin 서버 시작 (port 8080) ..." -ForegroundColor Green
& $venvPython -m uvicorn app.main:app --reload --port 8080
