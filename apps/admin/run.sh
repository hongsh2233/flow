#!/bin/bash
# 의존성: cd apps/admin && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
# (finance-datareader·pandas 등 조건검색용 패키지 포함)
# 1. 가상환경 활성화 (맥/리눅스용 경로)
source venv/bin/activate

# 2. 환경 변수 설정
export PYTHONPATH=.

# 3. 서버 실행 — Open http://127.0.0.1:8080/ (omit :8080 → browser uses port 80 → timeout)
echo "Jurin admin: http://127.0.0.1:8080/  (API docs: /docs)"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8080