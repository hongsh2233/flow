#!/usr/bin/env bash
# Run FastAPI admin (BO) from repo root -> apps/admin
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/apps/admin"
exec ./run.sh
