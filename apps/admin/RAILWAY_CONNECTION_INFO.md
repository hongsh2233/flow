# Railway PostgreSQL 연결 정보 입력

아래 항목을 입력해주세요:

## 필수 정보

### 방법 1: DATABASE_URL 사용 (가장 간단)

```
DATABASE_URL=postgresql://user:password@host:port/database
```

예시:
```
DATABASE_URL=postgresql://postgres:abc123@containers-us-west-123.railway.app:5432/railway
```

---

### 방법 2: 개별 변수 사용

다음 5개 항목을 입력해주세요:

1. **Host (호스트 주소)**
   ```
   예: containers-us-west-123.railway.app
   또는 IP 주소
   ```

2. **Port (포트 번호)**
   ```
   예: 5432
   ```

3. **User (사용자명)**
   ```
   예: postgres
   ```

4. **Password (비밀번호)**
   ```
   예: abc123xyz
   ```

5. **Database (데이터베이스 이름)**
   ```
   예: railway
   또는 stock_bo
   ```

---

## 추가 설정 (선택사항)

6. **ADMIN_EMAIL** (관리자 이메일)
   ```
   예: admin@example.com
   ```

7. **ADMIN_PW** (관리자 비밀번호)
   ```
   예: your_password_here
   ```

8. **SECRET_TOKEN** (세션 인증 토큰)
   ```
   예: your_random_secret_token
   ```

9. **JWT_SECRET_KEY** (JWT 토큰 암호화 키)
   ```
   예: your_jwt_secret_key
   ```

10. **DATA_GO_KR_API_KEY** (공공데이터포털 API 키 - 선택사항)
    ```
    예: your_api_key_here
    ```

---

## 입력 방법

**방법 1을 사용하는 경우:**
- `DATABASE_URL`만 입력해주세요

**방법 2를 사용하는 경우:**
- 1~5번 항목을 모두 입력해주세요
- 6~10번은 선택사항입니다

입력해주시면 `.env` 파일을 자동으로 생성해드리겠습니다!

