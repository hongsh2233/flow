# Railway 배포 시 캘린더(일정) API 연동

## 문제: Railway 빌드 후 데이터를 가져오지 못함

### 원인
- `.env.local`은 gitignore되어 **Railway에 배포되지 않음**
- Railway 빌드/런타임 시 **Railway Variables**만 사용됨
- `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_X_API_KEY`가 Variables에 없으면 기본값(localhost) 사용 → Admin 연결 실패

## 해결: Railway web_new 서비스 Variables 설정

**Railway 대시보드 → web_new 서비스 → Variables** 에 아래 변수 추가:

| 변수명 | 값 | 필수 |
|--------|-----|------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://jurin-i-production.up.railway.app` | ✅ |
| `NEXT_PUBLIC_X_API_KEY` | Admin과 동일 (예: `1978022019820308200705092018111420220303`) | ✅ |
| `NEXTAUTH_URL` | web_new 배포 URL (예: `https://xxx.up.railway.app`) | ✅ |
| `NEXTAUTH_SECRET` | 32자 이상 랜덤 문자열 | ✅ |

### Admin URL 확인
- Admin 서비스 URL: Railway → Admin 서비스 → Settings → Networking → Domain
- 예: `https://jurin-i-production.up.railway.app` (trailing slash 없이)

### Variables 추가 후
1. **Redeploy** 필수 (Variables 변경 후 재배포)
2. 빌드가 새로 실행되며 env가 반영됨
