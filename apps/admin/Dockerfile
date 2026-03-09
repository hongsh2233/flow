# 1. 안정적인 운영을 위해 가볍고 검증된 Python 이미지를 기반으로 합니다.
FROM python:3.12-slim

# 2. 컨테이너 내부의 작업 공간을 설정합니다.
WORKDIR /workspace

# 3. 환경 변수 설정 (Python의 로그 출력을 즉시 확인하기 위함)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/workspace


# 4. 종속성 설치를 위해 필요한 라이브러리들을 설치합니다 (PostgreSQL 연결 등)
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 5. 종속성 파일(requirements.txt)을 먼저 복사하여 캐시 효율을 높입니다.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. 소스 코드 전체를 컨테이너로 복사합니다.
COPY . .

# 7. uploads 디렉토리 생성 및 권한 설정 (배너 이미지 등 업로드 파일 저장용)
RUN mkdir -p uploads/banners uploads/images uploads/files && \
    chmod -R 755 uploads

# 8. Cloud Run 권장 사항에 따라 8080 포트를 개방합니다.
EXPOSE 8080

# 8. 서버를 실행합니다. uvicorn을 사용하여 app.main의 FastAPI 객체를 실행합니다.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
