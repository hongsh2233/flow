#!/bin/sh
# Jurin-i monorepo Git 초기화 (원격 저장소 연결 후 push 가능)
cd "$(dirname "$0")/.."
git init
git add -A
git status
echo "---"
echo "이제 커밋: git commit -m \"Initial commit: jurin-i monorepo\""
echo "원격 연결: git remote add origin <원격URL>"
echo "푸시: git branch -M main && git push -u origin main"
