# Jurin-i monorepo Git 초기화 (원격 저장소 연결 후 push 가능)
Set-Location $PSScriptRoot\..
if (Test-Path .git) { Write-Host ".git 이미 존재합니다." } else { git init }
git add -A
git status
Write-Host "---"
Write-Host "이제 커밋: git commit -m `"Initial commit: jurin-i monorepo`""
Write-Host "원격 연결: git remote add origin <원격URL>"
Write-Host "푸시: git branch -M main && git push -u origin main"
