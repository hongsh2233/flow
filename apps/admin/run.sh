#!/bin/bash
# 1. 가상환경 활성화 (맥/리눅스용 경로)
source venv/bin/activate

# 2. 환경 변수 설정
export PYTHONPATH=.

# 3. 서버 실행
uvicorn app.main:app --reload --port 8080