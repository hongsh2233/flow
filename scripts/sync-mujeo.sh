#!/bin/sh
# scripts/무제.md → apps/admin/scripts/무제.md 동기화
# 빌드 전 또는 무제.md 수정 후 실행
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/무제.md"
DST="$SCRIPT_DIR/../apps/admin/scripts/무제.md"
if [ -f "$SRC" ]; then
  cp "$SRC" "$DST"
  echo "✓ 무제.md → apps/admin/scripts/무제.md 동기화 완료"
else
  echo "⚠ scripts/무제.md 없음"
  exit 1
fi
