#!/bin/bash
# 가상 환경 설정 스크립트

# 가상 환경이 없으면 생성
if [ ! -d "venv" ]; then
    echo "가상 환경을 생성하는 중..."
    python3 -m venv venv
fi

# 가상 환경 활성화
source venv/bin/activate

# 패키지 설치
echo "패키지를 설치하는 중..."
pip install -r requirements.txt

echo "설정이 완료되었습니다!"
echo "이제 './run.sh'를 실행하여 서버를 시작할 수 있습니다."

