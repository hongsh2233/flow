# 캘린더 API 연동 구조

## 데이터 흐름

```
[캘린더 페이지] → fetchSchedules() → /api/schedules (Next.js) → Admin API (/api/schedules)
                    scheduleService     app/api/schedules/route.ts   (API_BASE_URL / NEXT_PUBLIC_API_BASE_URL)
```

## Admin (BO) 일정 API

| 항목 | 값 |
|------|-----|
| 엔드포인트 | `GET /api/schedules` |
| 인증 | `X-API-KEY` 헤더 (Admin NEXT_PUBLIC_X_API_KEY와 동일) |
| Query | `start_date`, `end_date`, `type` (YYYY-MM-DD) |
| 응답 | `{ success, data: [...], count }` |

## Railway 배포 시 (필수)

`.env.local`은 gitignore되어 **Railway에 없음**. 반드시 **Railway Variables** 설정:

| 변수 | 값 |
|------|-----|
| `NEXT_PUBLIC_API_BASE_URL` | Admin 서비스 URL (예: `https://jurin-i-production.up.railway.app`) |
| `NEXT_PUBLIC_X_API_KEY` | Admin과 동일 |

→ **설정 후 Redeploy** 필수.

상세: `RAILWAY_CALENDAR_SETUP.md` 참고.
