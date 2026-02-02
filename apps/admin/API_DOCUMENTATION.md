# REST API 문서

이 문서는 Stock BO 시스템의 REST API 엔드포인트를 설명합니다.

## 인증

모든 API 엔드포인트는 JWT 토큰 기반 인증을 사용합니다.

### 인증 방법

```
Authorization: Bearer <JWT_TOKEN>
```

### 토큰 발급

로그인 API를 통해 토큰을 발급받을 수 있습니다.

```
POST /api/auth/token
Content-Type: application/json

{
  "username": "admin@example.com",
  "password": "password"
}
```

응답:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

---

## 게시판 API

### 게시판 목록 조회

```
GET /api/boards
Authorization: Bearer <token>
```

응답:
```json
{
  "success": true,
  "data": [
    {
      "id": "B001",
      "name": "공지사항",
      "type": "korean",
      "auth": "all",
      "created_at": "2025-01-01T00:00:00",
      "updated_at": "2025-01-01T00:00:00",
      "post_count": 10
    }
  ],
  "count": 1
}
```

### 게시판 상세 조회

```
GET /api/boards/{board_id}
Authorization: Bearer <token>
```

### 게시판의 게시글 목록 조회

```
GET /api/boards/{board_id}/posts?page=1&limit=10
Authorization: Bearer <token>
```

쿼리 파라미터:
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 10, 최대: 100)

### 게시글 상세 조회

```
GET /api/posts/{post_id}
Authorization: Bearer <token>
```

---

## 일정 관리 API

### 일정 목록 조회

```
GET /api/schedules?start_date=2025-01-01&end_date=2025-12-31&type=manual
Authorization: Bearer <token>
```

쿼리 파라미터:
- `start_date`: 시작 날짜 (YYYY-MM-DD, 선택)
- `end_date`: 종료 날짜 (YYYY-MM-DD, 선택)
- `type`: 일정 타입 ('manual', 'api', 선택)

### 일정 상세 조회

```
GET /api/schedules/{schedule_id}
Authorization: Bearer <token>
```

---

## 한국거래소(KRX) 데이터 API

### KRX 데이터 조회

```
GET /api/krx-data?data_type=kospi&bas_dd=20251230
Authorization: Bearer <token>
```

쿼리 파라미터:
- `data_type`: 데이터 타입 ('kospi', 'kosdaq', 'market', 선택)
- `bas_dd`: 기준일자 (YYYYMMDD, 선택, 없으면 최신 데이터)

### KRX 데이터 날짜 목록 조회

```
GET /api/krx-data/dates?data_type=kospi
Authorization: Bearer <token>
```

쿼리 파라미터:
- `data_type`: 데이터 타입 ('kospi', 'kosdaq', 'market', 선택)

---

## 금융위원회(FSC) 주식시세정보 API

### 주식시세정보 조회

```
GET /api/fsc-stock-price?bas_dt=20251230&limit=200
Authorization: Bearer <token>
```

쿼리 파라미터:
- `bas_dt`: 기준일자 (YYYYMMDD, 선택, 없으면 최신 데이터)
- `limit`: 반환할 최대 항목 수 (기본값: 200, 최대: 1000)

응답:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bas_dt": "20251230",
      "srtn_cd": "005930",
      "itms_nm": "삼성전자",
      "mrkt_tot_amt": "500000000000",
      "clpr": "75000",
      "flt_rt": "1.5",
      ...
    }
  ],
  "bas_dt": "20251230",
  "count": 200
}
```

### 주식시세정보 날짜 목록 조회

```
GET /api/fsc-stock-price/dates
Authorization: Bearer <token>
```

---

## 수집 데이터 API

### 수집 데이터 조회

```
GET /api/collected-data?type=api&status=success&limit=100
Authorization: Bearer <token>
```

쿼리 파라미터:
- `type`: 데이터 타입 필터 (선택)
- `status`: 상태 필터 (예: 'success', 'failed', 선택)
- `limit`: 반환할 최대 항목 수 (기본값: 100, 최대: 1000)

### 수집 데이터 상세 조회

```
GET /api/collected-data/{data_id}
Authorization: Bearer <token>
```

---

## 에러 응답

모든 API는 에러 발생 시 다음 형식으로 응답합니다:

```json
{
  "detail": "에러 메시지"
}
```

HTTP 상태 코드:
- `200`: 성공
- `401`: 인증 실패
- `404`: 리소스를 찾을 수 없음
- `500`: 서버 오류
