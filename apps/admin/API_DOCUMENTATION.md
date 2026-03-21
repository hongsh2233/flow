# Admin API 문서

FastAPI 백엔드 REST API 명세. 전체 API 문서는 `/docs` (Swagger UI) 또는 루트 `README.md` 참고.

## 베이스 URL

- 로컬: `http://localhost:8080`
- 프로덕션: Railway 배포 URL

## 인증

```
# 서비스 간 인증 (프론트엔드 → 백엔드)
X-API-KEY: your-api-key

# 회원 API 인증
Authorization: Bearer <JWT_TOKEN>
```

## 주요 엔드포인트

### 인증 (`/api/auth`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/member/login` | 이메일 로그인 → JWT 반환 |
| POST | `/api/auth/member/signup` | 회원가입 |
| POST | `/api/auth/social-login` | 소셜 로그인 (google) |
| POST | `/api/auth/member/reissue-token` | 토큰 재발급 |
| GET  | `/api/auth/member/me` | 내 정보 조회 (Bearer 필요) |
| PUT  | `/api/auth/member/me` | 내 정보 수정 (Bearer 필요) |

### 게시판 (`/api/boards`, `/api/posts`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | `/api/boards` | 게시판 목록 |
| GET  | `/api/boards/{id}/posts` | 게시글 목록 |
| GET  | `/api/posts/{id}` | 게시글 상세 |
| GET  | `/api/main-posts?limit=3` | 메인 노출 게시글 (최대 3개) |

### 일정 (`/api/schedules`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | `/api/schedules` | 일정 목록 (`?start_date&end_date`) |
| POST | `/api/schedule-alarms` | 일정 알림 신청 |

### 주식 데이터

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | `/api/market/indices` | 시장 지수 |
| GET  | `/api/market/investor-trend` | 투자자 동향 |
| GET  | `/api/stocks/search?q=삼성` | 종목 검색 |

### 알림 / FCM

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | `/api/notifications` | 알림 목록 |
| POST | `/api/fcm-token` | FCM 토큰 등록 |

## 소셜 로그인 상세

```json
POST /api/auth/social-login
Content-Type: application/json
X-API-KEY: your-api-key

{
  "provider": "google",
  "email": "user@example.com",
  "name": "홍길동",
  "provider_id": "google_unique_user_id"
}
```

응답:
```json
{
  "success": true,
  "message": "회원 정보가 저장되었습니다.",
  "member_id": 1,
  "nickname": "투자자123",
  "profile_image": "https://...",
  "grade": "regular",
  "has_nickname": false,
  "access_token": "eyJ..."
}
```
